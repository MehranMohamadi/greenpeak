# Email signup with Resend

GreenPeak signs users in with an email or username and password. New accounts
must verify their email before they can access authenticated dashboard APIs.
Existing username-only accounts remain usable. Email verification, resend and
password recovery use Resend's HTTPS API; there is no Google integration or
SMTP configuration, and no additional Python dependency is required.

## Activate delivery

1. In Resend, add a domain/subdomain you own and copy its exact DNS records to
   your DNS provider. Wait for the sending domain to become verified. Prefer
   an auth subdomain for verification and recovery emails.
2. Create a **Sending access** API key restricted to that domain. Keep open/click
   tracking disabled for authentication emails so verification fragments are
   preserved and recovery links are not tracked.
3. Set backend values in the repository-root `.env` or the backend process
   environment. The server-owned `front2/.env.production.local` is also read
   by this project's backend settings and takes precedence over root `.env`.

```dotenv
AUTH_SECRET_KEY=<random secret of at least 32 characters>
AUTH_PUBLIC_URL=https://<your actual frontend domain>
AUTH_EMAIL_TOKEN_TTL_SECONDS=3600
RESEND_API_KEY=<your restricted Resend API key>
AUTH_EMAIL_FROM=GreenPeak <no-reply@your-verified-domain>
```

For local testing use `AUTH_PUBLIC_URL=http://localhost:3000`. Use the exact
browser origin, with no path. Keep keys on the backend, never in `NEXT_PUBLIC_*`
variables, source control, chat or logs. Restart FastAPI after configuring.
No email bypass or token logging is enabled when delivery is unavailable.
Resend rejects sending to arbitrary recipients before domain verification;
its initial test sender is limited to your own account email.

## Contracts and behavior

- `POST /api/v1/auth/signup` requires `{username, email, password}` and returns
  a message and `verification_required`, without a login token.
- Login accepts username or email, preserves the existing bearer response
  contract, and rejects pending email accounts. Passwords for new accounts
  require 8–128 characters. Existing accounts/passwords still work.
- Public routes: `/verify-email`, `/resend-verification`, `/forgot-password`
  and `/reset-password`. Verification and reset require explicit submission;
  opening an email does not consume the link.
- Tokens contain 256 bits of randomness, are stored as SHA-256 hashes, expire
  at the configured TTL and are consumed atomically. A resend replaces the
  earlier token and has a 60-second per-account cooldown. Resend receives an
  idempotency key derived from the token hash; provider errors never reach
  clients or logs with credentials or token contents.
- Password recovery proves email ownership and revokes old sessions. Missing
  accounts receive the same recovery/resend message as eligible accounts.
- Session persistence uses HttpOnly, SameSite=Lax cookies (Secure with HTTPS).
  Bearer tokens stay in React memory for existing private dashboard API calls.
  Old localStorage sessions migrate once to a cookie. Use the existing
  same-origin `/api/v1` Next.js/nginx proxy; cross-site overrides need separate
  cookie/CORS deployment configuration. Logout clears the browser cookie;
  copied bearer tokens remain valid until expiry or password reset.
- User email fields have a unique MongoDB partial index. Development SQLite
  adds the email field/index without replacing existing users. No raw market
  collections are changed.

Auth writes have a per-process limit of 30 requests per 10 minutes per IP.
Use a shared/edge limiter with multiple backend workers, and configure trusted
forwarded IPs so clients don't share the proxy IP or forge their source.
Synchronous delivery can cause response timing differences despite generic
recovery/resend messages; queue delivery for stronger enumeration protection.

## Validation

```powershell
cd backend2
.\.venv\Scripts\python.exe -m pytest tests/test_auth.py tests/test_auth_email.py
```

Offline checks cover single-use/expired/replaced links, pending-account access,
password/session recovery, legacy SQLite migration, Resend request/error
handling, and full application startup/health/auth round trips. Actual delivery
requires your verified domain and key. No production deployment is performed
by these tests.

References: [Resend domains](https://resend.com/docs/dashboard/domains/introduction),
[sending API](https://resend.com/docs/api-reference/emails/send-email),
[API key permissions](https://resend.com/docs/dashboard/api-keys/introduction).
