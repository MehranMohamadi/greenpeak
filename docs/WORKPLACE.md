# GreenPeak workplace

`/workplace` provides personal attendance and free-text activity reports.
`/admin/employees` provides current presence, monthly summaries, individual
reports, manual time corrections, approval/rejection of correction requests,
and assignment of the `staff` role to existing users. Both entry buttons are
shown only in the profile, according to role. The main dashboard is unchanged.

The **کارها** tab adds internal work assignment, submissions, administrator
review, discussion, history and in-workplace notifications. It reuses these same
roles and database but keeps attendance records independent. See
[WORK_TASKS.md](WORK_TASKS.md) for its permissions, API and setup.

## Identity and storage

The existing signed session and live `gp_users.role` are the authority:

- `user`: existing site features; no workplace access.
- `staff`: existing user features and their own workplace records.
- `admin`: all existing admin capabilities, their own workplace and all employee reports.

Developers are staff. Signup remains `user`. No account is created, no existing
role is migrated, and no premium-analysis permission is modified by this feature.
The new staff-role endpoint explicitly refuses changes to administrators.
Existing account promotion, demotion and deletion endpoints remain available.

MongoDB uses `gp_work_sessions` and `gp_workplace_locks` in **the same database as
authentication**. Indexes are created lazily on first authorized use. The user
ID is the existing account ID. If authentication is using the existing explicit
development SQLite fallback, `gp_work_sessions` is a table in that same SQLite
file. Attendance never invents a separate fallback when storage is unavailable;
the request fails with a sanitized 503.

Each work session stores its immutable ID/owner, check-in/out, `activities`
text, revision, correction requests and append-only audit entries. Audit entries
include actor ID **and username**, server timestamp, reason, and before/after
values. Time edits and approvals save the audit entry and session in the same
atomic document update. Requests also retain original/proposed times and
reviewer identity/note. Logical user deletion or role changes preserve history;
administrators can still read that history. There is no attendance deletion API.

SQLite uses a write transaction. MongoDB serializes employee mutations with a
two-minute leased lock, checks the lease before writing, uses revision checks
for document replacement and enforces one open session with a unique partial
index. Concurrent actions return 409; clients must refresh before retrying.
These operations also work on standalone MongoDB without replica-set transactions.

## Time and reporting

Clock-in/out use server UTC instants, with no client-supplied attendance clock.
Manual corrections require offset-aware timestamps and a reason. Future times,
exit-before-entry and overlapping sessions are rejected. Multiple consecutive
sessions per day are supported; an open session must be closed before a new one.
Administrators can also add an entirely missing session with a recorded reason.

Reports accept Gregorian `start_date`/`end_date` query values, inclusive, at most
63 dates. Python splits elapsed time at Tehran local midnight and clips it to
the report range. Open sessions count only through `generated_at`. The current
open session is returned even when the selected report covers a previous month.
API durations are integer seconds. The UI displays Persian dates, Tehran times
and hours/minutes, and converts a selected **Persian calendar month** to the API
range. Historical timezone rules are respected; totals are calculated by Python.

An employee's correction request never changes time immediately. Approval
rechecks the original times and all overlaps against the current database;
outdated requests must be rejected and resubmitted. Approval/rejection cannot
be replayed. Editing activities after a request is allowed and does not lose
the new text when that request is approved.

`activities` accepts up to 10,000 characters, allowing prose or one task per line,
and is editable during a session, on exit, or afterwards by its owner. Revision
checks protect saved text from concurrent updates. The UI retains dirty activity
text on a background refresh and asks for a refresh when the revision conflicts.
Activity history is preserved. Stable session/user IDs and the separate workplace
service leave room for task references and future work-report modules.

## API

All routes require the existing bearer session and return `Cache-Control: no-store`.
Staff routes derive the owner from the verified session, never a submitted user ID:

```text
GET  /api/v1/workplace/me/report
POST /api/v1/workplace/me/clock-in
POST /api/v1/workplace/me/clock-out
PUT  /api/v1/workplace/me/sessions/{session_id}/activities
POST /api/v1/workplace/me/sessions/{session_id}/corrections
```

Every management route independently requires the current `admin` role:

```text
GET  /api/v1/workplace/admin/employees
GET  /api/v1/workplace/admin/employees/{user_id}/report
POST /api/v1/workplace/admin/employees/{user_id}/sessions
PUT  /api/v1/workplace/admin/sessions/{session_id}/times
GET  /api/v1/workplace/admin/corrections
POST /api/v1/workplace/admin/sessions/{session_id}/corrections/{request_id}/review
PUT  /api/v1/auth/users/{user_id}/staff-role
```

Next.js checks the session server-side for both page families; backend checks
remain authoritative for every request. Mutations with input contracts reject
unexpected fields; clock-in ignores client data and always uses the server clock.

## Local validation

From `backend2`: `.venv/Scripts/python.exe -m pytest tests/test_workplace.py -q`.
The tests use isolated SQLite files and an in-memory Mongo protocol test double,
never production records or external services. Coverage includes real app
lifespan/health, live roles, ownership, manual entries, overnight/month boundaries,
activity persistence, concurrent clock-in/out, conflicting edits, atomic approvals,
pending request conflicts and sanitized storage failures.

From `front2`: `node --test tests/workplace-*.test.mjs`, `npx.cmd tsc --noEmit`,
and `npm.cmd run build` on Windows. Visual browser and real MongoDB integration
checks require those facilities to be available; protocol doubles do not replace
a production MongoDB integration check.
