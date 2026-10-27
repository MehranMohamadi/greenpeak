# Administrator access

`gp_users.role` is `user`, `staff`, or `admin`. Registration always creates a
`user`. Authorization reads the current database role on every protected API
request; changing the role takes effect even for an existing signed session.
Subscription status is independent of this role.

Staff and administrators can use `/workplace`; only administrators can use its
`users` and `tools` tabs and team attendance management. Its entry is in `/profile`. The existing `admin`
role keeps every existing permission; attendance does not create accounts or
run a role migration. Administrators assign `user`/`staff` through the users and access
tab (`/workplace?tab=users`) or `PUT /api/v1/auth/users/{user_id}/staff-role`. This endpoint
cannot modify an administrator and does not change premium-analysis access.
Programmers use the same `staff` role. See [WORKPLACE.md](WORKPLACE.md).

The administrator entry is the **کاربران و دسترسی‌ها** tab at
`/workplace?tab=users`. `/admin` and `/admin/settings` redirect there behind the
existing admin page guard; `/admin/employees` redirects to team attendance.
The single account list displays usernames, roles, activation state,
registration dates and premium-analysis access, never credentials. Inspection
tools are in `/workplace?tab=tools`. Both tabs require administrator access.
Admins can promote a user with the user-list action or
`POST /api/v1/auth/users/{user_id}/promote`. Admins can also demote another admin
via `POST /api/v1/auth/users/{user_id}/demote`, or delete an account via
`DELETE /api/v1/auth/users/{user_id}` with an exact `confirmation_username` body.
Self-demotion and self-deletion are rejected. Destructive account changes are
serialized and recheck the acting admin's live role to preserve an active admin.
Deletion is logical: the account disappears from lists, becomes inactive and
has sessions invalidated; Mongo-backed MT5 connections are revoked. Financial
snapshots and chat history are retained. The identity remains reserved, so it
cannot be registered again or revived through promotion. The timestamp and acting admin ID
are recorded on the target account. Existing signed sessions use the new role on
their next API request; refreshing the browser restores the updated UI role.

Admin-only capabilities:

- Complete feature pipeline inspection and preview, including `?mode=debug`.
- Complete MT5 snapshot history for the authenticated owner's accounts.
- Manual analysis execution and run status.
- Internal architecture documentation and the administrator list.
- Broker/sample counters and analysis provenance in diagnostic responses.

Regular users retain charts, financial analysis, anonymized broker comparisons,
their own MT5 dashboard, source/date/unit information and quality warnings.
`POST /api/v1/indicators/features/preview` returns financial features without
pipeline stages. Normal analysis responses exclude internal versions, provenance
and coverage counters; admins can request `?mode=debug` with their session bearer
token. MT5 ownership restrictions also apply to administrators.

## One-time existing-account migration

Run from `backend2`, against the intended configured database:

```powershell
$env:DEBUG = "false"
.\.venv\Scripts\python.exe -m src.services.admin_migration
```

The migration captures existing account IDs, preserves their previous roles in
`gp_auth_migrations`, and promotes that set. Re-running does not promote newer
registrations. MongoDB migration resumes an interrupted update using the same
captured IDs. The development SQLite fallback uses one atomic transaction and
its own migration record. Neither signup, login nor application startup runs
this migration automatically.

Check the printed per-store status: an unavailable MongoDB has not been migrated.
The command only updates locally configured stores; it does not deploy or connect
to a separately configured production server.

## One-time production username rename

`deploy/deploy-production.sh` runs `src.services.username_migration` before
activating a release. It renames `mreal` to `test` in the configured MongoDB,
preserving the account ID, password hash, email, role, and associated data.
The account must sign in again with `test` and its existing password afterward.

Migration `rename-mreal-to-test-v1` in `gp_auth_migrations` captures the account
ID before writing and records completion. Retries resume against that ID;
completed migrations do nothing, even if someone later registers `mreal`.
A missing source account, occupied `test` username, or database failure stops
deployment before release activation and never overwrites another account.
SQLite development accounts are not changed. Rolling back the application
release does not undo this database rename.
