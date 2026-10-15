# Per-user premium analysis access

Administrators use the “تحلیل‌های پرمیوم” switch for each account at
`/admin/settings`. One persisted `gp_users.can_view_premium_analysis` boolean
controls every restricted analysis. Missing/false means locked, including for
existing accounts. Administrators always have access independently of this flag.
This is an analysis entitlement; it does not grant admin privileges or implement
billing. No migration or overwrite of existing user fields is required.

`PUT /api/v1/auth/users/{id}/analysis-access` accepts `{ "enabled": true/false }`,
requires a verified current admin and records actor/time. Login, session, `/me`
and admin user-list responses expose the boolean, never auth secrets. Every
protected API request resolves current DB permissions rather than JWT claims.
The UI refreshes the current user each minute and when the tab becomes visible.

Protected sections:

- Indicator and group narrative endpoints: 403 `PREMIUM_ANALYSIS_REQUIRED`.
- Market short-term outlook, medium-term outlook and five-point conclusion:
  stripped from public/locked responses. Legacy duplicate outlook prose is also
  stripped. Explicit current market flow, factors, news/calendar and status cards
  remain available. The same redaction applies to chatbot retrieval.
- Indicator/group UI analysis cards, including existing deterministic analysis
  cards; charts and public numerical feature APIs keep their existing contracts.
- Dashboard text analysis in new trade review, saved plan detail and allocation
  behavior analysis: show “مخصوص کاربران پرمیوم” while locked. Existing local
  trade calculations, plans, metrics and allocation controls remain available.

The existing client-calculated dashboard tools are presentation-gated; their
formulas are shipped as client code and are not confidential server content.
Chat requests use the current entitlement for retrieval and instructions; the
assistant must not reconstruct restricted analysis from earlier conversation.
Previously delivered data or chat messages cannot be retroactively unseen.

Connection guidance in the chatbot uses the current profile flow at
`/profile#broker-connection`: named connection, token creation, one-time token
display, expert input `GreenPeakApiToken`, WebRequest to the expert's configured
API address, and first snapshot before connected status. File/video sections are
currently placeholders; the assistant must not invent downloads or credentials.

Profile notification preferences retain the existing per-account local-storage
key and merge defaults when read. `generalMessages` and `forYou` add two switches
without deleting the previous four switches or any saved price alerts. These are
preferences in the current browser, not a newly implemented delivery service.
