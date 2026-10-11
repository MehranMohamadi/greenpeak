# Administrator access

`gp_users.role` is either `user` or `admin`. Registration always creates a
`user`. Authorization reads the current database role on every protected API
request; changing the role takes effect even for an existing signed session.
Subscription status is independent of this role.

The administrator entry is `/admin/settings`, also linked from the profile menu
and personal settings for admins. It lists account usernames, IDs,
roles, activation state and registration dates, never credentials. Both the
administrator list and the complete user list require administrator access.

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
