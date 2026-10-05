# Google sign-in and email verification

GreenPeak supports Google Identity Services and username/email/password login.
New password accounts cannot sign in until their email is verified. Existing
username-only accounts remain usable and can connect Google from Settings.

## Configuration

Set these backend variables in the repository-root `.env` (do not commit secrets):

```dotenv
AUTH_SECRET_KEY=<random secret of at least 32 characters>
AUTH_PUBLIC_URL=https://<your actual frontend domain>
GOOGLE_CLIENT_ID=<web client ID from Google Cloud>
AUTH_EMAIL_TOKEN_TTL_SECONDS=3600
SMTP_HOST=<mail provider SMTP host>
SMTP_PORT=587
SMTP_USERNAME=<SMTP username>
SMTP_PASSWORD=<SMTP password>
SMTP_FROM=GreenPeak <no-reply@your-domain>
SMTP_STARTTLS=true
SMTP_SSL=false
```

For local development set `AUTH_PUBLIC_URL=http://localhost:3000`. For implicit
TLS on port 465 set `SMTP_SSL=true` and `SMTP_STARTTLS=false`. Verify your sender
domain with the mail provider, including its SPF/DKIM requirements. SMTP
credentials belong only on the backend. No frontend Google secret is needed.

Install backend requirements and restart FastAPI. In Google Cloud configure the
Google Auth Platform consent/branding and a **Web application** OAuth client.
Add the exact frontend origin as an Authorized JavaScript origin (also add
`http://localhost:3000` for local testing). This implementation uses the GIS
JavaScript credential callback, so it does not need an OAuth redirect URI.
Complete the Google app publishing requirements before serving public users.
When Google is not configured its button remains visible but disabled; missing SMTP configuration
returns a safe error instead of creating an account that cannot be verified.
There is no development email bypass and verification tokens are never logged.

Keep `/api/v1` on the same public origin as the frontend, using the existing
Next.js rewrite/nginx proxy. Cross-site API overrides are not supported by the
SameSite cookies without additional deployment changes. `AUTH_PUBLIC_URL` must
match the browser origin exactly, with no path component. HTTPS makes session
and Google challenge cookies Secure; all session cookies are HttpOnly.

## Behavior and compatibility

- Signup requires `{username, email, password}` (8–128 character password) and
  returns a message and `verification_required`, without an access token.
- Login still returns `{access_token, token_type, user}` and accepts a username
  or email. Session persistence uses an HttpOnly cookie; the bearer token stays
  in React memory for existing authenticated API consumers. Old localStorage
  sessions migrate once through `/auth/session/migrate`.
- Gmail and verified Google Workspace identities skip extra email verification.
  Other Google email domains require a verification link before access.
- Accounts are keyed by Google's `sub`. Matching email addresses never cause
  automatic linking. Existing users sign in first and connect Google in Settings.
- Verification/reset tokens use 256 bits of randomness, are stored only as
  hashes, expire after the configured TTL, and are consumed atomically. Each
  resend replaces the prior link and has a 60-second per-account cooldown.
- Email links put the token in a URL fragment (excluded from server access logs
  and Referrer headers), then require an explicit form submission. Verification
  does not automatically log in; password recovery revokes prior sessions.
- Password recovery does not add a password to Google-only accounts. They use
  Google sign-in. Recovery/resend give a generic response for missing accounts.
- New identity fields and unique indexes live in `gp_users`, with an automatic
  additive SQLite migration for the development fallback. Existing users are
  not assigned invented emails or verification states.

Authentication endpoints have a per-process 30 requests/10 minute IP guard.
For multiple backend workers, add a shared/edge limiter. Configure your proxy
and Uvicorn's trusted forwarded IPs correctly so clients do not all share the
proxy's IP and untrusted clients cannot forge their source address. The reset
and resend response content is generic, but synchronous SMTP can cause timing
differences; use queued mail delivery if stronger enumeration protection is
required. Logout clears the browser session cookie; a copied bearer token can
still be used until expiration. Resetting the password revokes such tokens.

## Validation

```powershell
cd backend2
.\.venv\Scripts\python.exe -m pytest tests/test_auth.py tests/test_auth_identity.py
```

Offline tests cover verification, reuse/expiration, recovery, session revocation,
Google identity collisions/linking, nonce/origin protection, rate limiting, and
SQLite persistence/migration. Real Google consent/sign-in and SMTP delivery
require your configured accounts and must be checked after configuration.

References: [Google server token verification](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token),
[GIS JavaScript API](https://developers.google.com/identity/gsi/web/reference/js-reference),
[OWASP password recovery](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html).
