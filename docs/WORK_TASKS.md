# Internal work management

Entry: **Profile → میز کار من → کارها**. The employee-management page also
offers the same work tab to its verified administrator. Attendance remains a
separate tab, with its forms mounted so switching tabs retains unsaved notes.
Everything uses the existing `gp_users` identity, live `staff`/`admin` roles,
session bearer token, UI components, and central API endpoint map. Ordinary
site users cannot access work, including work marked as visible to the team.
No administrator or new role is created.

## Authorization

| Action | Administrator | Assignee | Creator | Other internal employee |
| --- | --- | --- | --- | --- |
| Read restricted work | Yes | Yes | Yes | No |
| Read team-visible work | Yes | Yes | Yes | Yes |
| Create for someone else | Yes, active staff/admin only | No | No | No |
| Create for oneself | Yes | Yes | Yes | Yes, with their own identity |
| Edit specifications | Yes | Only if also eligible creator | Before first delivery, while active | No |
| Change assignee or approval requirement | Yes | No | No | No |
| Change visibility | Yes | Only if also creator | Yes | No |
| Start / deliver | Only if assignee | Yes, in permitted state | Only if assignee | No |
| Add a comment | Yes | Yes | Yes | No |
| Approve / return for changes / cancel / reopen | Yes | No | No | No |

Employee creation always assigns the current user and requires approval by
default. Forged creator, timestamps, state and unknown input fields are rejected.
The creator snapshot cannot be edited. Team visibility grants viewing only.
Authorization is applied before title search, filters, pagination, counts and
notifications; unread counts and event links cannot reveal restricted work.
Reassignment immediately removes a former assignee's restricted access unless
they remain its creator. Live site roles are checked on every API request.

## Workflow and timestamps

States: `not_started`, `in_progress`, `awaiting_approval`, `completed`, `cancelled`.
The assignee can start or deliver directly from not-started. Delivery includes
an optional note and HTTP(S) result link, never an upload. Required approval
keeps the work pending until an admin approves. A correction request requires
a reason and returns the work to in-progress. Resubmission creates a new
submission, preserving all earlier results and reviews.

`submitted_at` and `approved_at` are independent server UTC instants. Each
submission stores its own due-date snapshot, delivery timing and reviewer.
Tehran's local date determines whether delivery met a date-only deadline.
Waiting for the administrator does not turn an on-time submission into late
delivery. The UI distinguishes unfinished overdue work, late delivery and
awaiting approval. Persian deadlines are converted only at the UI boundary.

Disabling approval creates `completion_mode=no_approval`, with no fabricated
approval actor/time. Approval creates `completion_mode=approved`. If an admin
disables approval on work that already has a pending result, that result is
completed without approval, with an explicit history event and UI explanation.
Changing a completed work's approval requirement applies to future delivery;
it does not rewrite its previous completion mode.

Administrators may cancel active work. Cancellation is separate from completion
and removes a pending review from the queue. Reopening completed work requires
a reason; earlier completion details remain in history, and submissions remain
unchanged. Creator edits stay locked after the first submission, even after
reopening. There is no permanent deletion API or UI.

## Persistence and notifications

`gp_work_tasks` lives in the **same MongoDB database as authentication**. For the
existing explicit development SQLite fallback, it is a table in that same auth
file. No separate file-based production fallback is introduced.

One work document contains specifications, immutable creator identity,
submissions/reviews, individual comments, history events and notification
recipients/read receipts. A mutation and its history/notifications commit in one
atomic document replacement. Standalone MongoDB uses compare-and-swap on
`storage_revision`, retrying harmless storage contention and rejecting stale
public revisions with 409. SQLite uses `BEGIN IMMEDIATE`. No replica-set
transactions or additional dependencies are needed.

The existing project has profile notification preferences and market-report
Telegram delivery, but no durable per-user internal notification service.
This feature therefore provides a notification inbox inside the work tab.
Assignment notifies the new assignee. Delivery for review notifies active
administrators. Approval, requested changes, cancellation and reopening notify
related people; comments notify the creator, assignee and active admins,
excluding the sender. Team visibility never broadcasts to the whole team.
Only users who still have access can read a notification or its count. Unread
items sort before read items, keeping older unread events reachable. Reading
an event changes only the internal storage revision, so it does not invalidate
an editor's public revision. Restricted work never sends any external message.

## Telegram in the existing Task topic

Team-visible work queues Telegram notifications for creation (including employee
self-creation), a changed assignee, submission awaiting approval, requested
corrections, final approval, and completion without approval. Starting work,
ordinary edits and individual comments do not queue Telegram messages. A direct
completion queues only its completion message, explicitly saying
**بدون نیاز به تأیید**; it never claims administrator approval. Turning off
approval while a result is pending also produces that distinct completion event.

Delivery reuses `src/utils/telegram.py`, the existing `TELEGRAM_BOT_TOKEN` and
`TELEGRAM_CHAT_ID`. Set the **verified numeric `message_thread_id` of the existing
Task topic** in `TELEGRAM_TASK_MESSAGE_THREAD_ID`. A display name is insufficient;
neither the market-report thread setting nor General is a fallback. General's
thread ID `1`, empty and malformed task-only settings disable task delivery
without breaking the main API or analysis. The local checkout does not contain
a verified Task topic ID or live Telegram credentials; no live message was sent.
Obtain the topic ID from the existing group's Task topic message/link or its
verified Telegram update, then set it server-side and restart the backend.
Do not create a second bot, group, channel, or topic. Telegram must permit the
existing bot to send to that forum topic. See the
[Telegram sendMessage contract](https://core.telegram.org/bots/api#sendmessage).

`AUTH_PUBLIC_URL` supplies the existing site's public origin for
`/workplace?task=<id>` links. The page selects the work tab and opens that work's
detail dialog through the existing authenticated API. Login retains only a
validated work identifier, with no arbitrary return URL. The existing page and
API guards still enforce live internal roles and per-work visibility. Telegram
provides no state-changing buttons, commands or private messages; all submission,
review and correction actions remain on the site under the existing admin role.

Messages contain bounded Persian text, creator, assignee, action actor, optional
numeric Persian deadline and an event-specific explanation. Correction messages
include the administrator's reason; submissions include their result note.
HTML-sensitive characters are escaped after shortening plain text. Full notes,
discussion and results remain available in the site. Deadline storage and API
dates stay Gregorian; only display is converted to the same numeric Persian
calendar as the work UI.

### Durable delivery and duplicate protection

Each eligible event stores an internal `telegram` outbox entry in the **same
atomic task write** as the state/history change. No request handler waits for
Telegram. Existing history is not backfilled. Restricted events have no outbox
entry; changing a private work to team-visible does not replay its private past.
The APScheduler mechanism already used by the application polls this outbox
every 15 seconds, independently of daily analysis/LLM enablement. Missing
configuration records a safe blocked error on new entries and disables this
worker until configured/restarted. Analysis scheduling and its own topic are
independent.

A worker atomically claims an event using the repository's existing Mongo CAS
or SQLite transaction. Claims and delivery receipts change only `storage_revision`,
not the public edit revision. Before every send/retry it reads the work again;
if currently restricted, delivery is permanently skipped. Notifications for each
work remain ordered. Explicit connection failures before sending and Telegram
rate-limit rejections retry with backoff, honoring `retry_after`, at most eight
network attempts. A rejected/missing topic or permission error is recorded and
never redirects to another topic. Saved work remains successful regardless of
Telegram delivery.

Successful events retain `message_id` and `sent_at` and cannot be claimed again.
Telegram `sendMessage` has no caller idempotency parameter: a timeout after
transmission or a crash after remote acceptance cannot safely be retried. These
outcomes, expired in-flight claims, malformed acknowledgments and server failures
become `uncertain` and **are not automatically resent**. Operators should verify
them in the Task topic rather than blindly reset them. A crash before attempting
a claimed send may consequently omit that one notification; this conservative
choice avoids sending a duplicate when acceptance cannot be established.

The work-creation form retains a UUID `request_id` across retries. Creation uses
an actor-scoped deterministic ID and request hash: identical retries return the
same work/event, while reusing the key with a different body returns 409. Other
state changes retain their existing public-revision checks and client action
lock. External delivery never changes roles or permissions.

Inspect `gp_work_tasks.events.telegram` (or the equivalent embedded SQLite
payload) for `pending`, `blocked`, `retry`, `sending`, `sent`, `skipped`, `failed`
and `uncertain`, attempts, next attempt, message receipt and safe `error_code`.
These fields and the creation hash are internal, absent from public task/history
responses. Logs contain event IDs and fixed error codes, never task text,
connection strings, response bodies or bot credentials. HTTPX Bot API URLs are
redacted, including for the existing market-report sender.

## API

All routes below require a verified internal employee and use `no-store`:

```text
GET/POST /api/v1/workplace/tasks
GET/PUT  /api/v1/workplace/tasks/{id}
POST     /api/v1/workplace/tasks/{id}/start
POST     /api/v1/workplace/tasks/{id}/submit
POST     /api/v1/workplace/tasks/{id}/comments
GET      /api/v1/workplace/tasks/notifications
POST     /api/v1/workplace/tasks/notifications/{id}/{event_id}/read
```

Verified administrator only:

```text
GET  /api/v1/workplace/tasks/people
POST /api/v1/workplace/tasks/{id}/review
POST /api/v1/workplace/tasks/{id}/cancel
POST /api/v1/workplace/tasks/{id}/reopen
```

List views: `mine`, `team`, admin `all` and admin `pending`. Filters include
title search, status (default active), deadline, optional date range, and admin
assignee selection. Completed/cancelled work remains available through filters.
PUT carries a partial, strictly validated change set plus the current public
revision; this method also works with the existing nginx method allowlist.

## Local setup and validation

No manual role migration or dependency installation change is required. Existing
admins can assign the `staff` role through employee management. Start the
existing backend and frontend normally. Tables/collections and indexes are
initialized lazily on authorized use. Existing attendance collections and
financial raw observations are untouched.

Run offline tests from `backend2`:

```powershell
$env:DEBUG = "false"
.\.venv\Scripts\python.exe -m pytest tests/test_work_tasks.py tests/test_workplace.py tests/test_admin_access.py
.\.venv\Scripts\python.exe -m pytest
.\.venv\Scripts\python.exe -m compileall src
```

Tests use temporary SQLite databases and a Mongo protocol test double, including
real app startup/health and work-plus-attendance round trips. No live user,
production database, ETL or external-message service is involved.

From `front2`: `node --test tests/*.test.mjs`, `npx.cmd tsc --noEmit`, and
`npm.cmd run build` on Windows. Real MongoDB and browser layout checks require
those facilities separately. No deployment is performed as part of this work.
