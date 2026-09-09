# IIEST Shibpur Portal — Backend

Express + MongoDB backend for the signup (OTP-verified, `@students.iiests.ac.in`
only) and login (with forgot-password) flows, matching the `fetch` calls
already in `signup.js` and `scripto.js`.

## 1. Install

```bash
cd backend
npm install
```

## 2. Configure

```bash
cp .env.example .env
```

Then edit `.env`:

- `MONGODB_URI` — local Mongo (`mongodb://127.0.0.1:27017/iiest_portal`) or an
  Atlas connection string.
- `ALLOWED_EMAIL_DOMAIN` — already set to `students.iiests.ac.in`.
- `JWT_VERIFICATION_SECRET` / `JWT_SESSION_SECRET` — set these to long random
  strings (`openssl rand -hex 32`).
- `SMTP_*` — an SMTP account to send OTP / temp-password emails from. For
  Gmail, create an **App Password** (regular passwords won't work):
  https://support.google.com/accounts/answer/185833
- `CLIENT_ORIGIN` — the origin your frontend is served from (e.g.
  `http://127.0.0.1:5500` for VS Code Live Server), so CORS allows it.

## 3. Run

```bash
npm run dev      # with nodemon, auto-restarts
# or
npm start
```

You should see:

```
MongoDB connected: iiest_portal
IIEST Portal backend running on http://localhost:5000
```

Both `signup.js` and `scripto.js` already point at
`http://localhost:5000/api/auth`, so no frontend URL changes are needed if
you run the backend on port 5000.

## What it does

| Endpoint | What happens |
|---|---|
| `POST /api/auth/send-otp` | Checks the email ends in `@students.iiests.ac.in`, checks it isn't already registered, generates a 6-digit OTP (hashed before storing, expires in 10 min), emails it. |
| `POST /api/auth/verify-otp` | Checks the OTP against the stored hash (max 5 attempts), and on success issues a short-lived `verificationToken` (JWT, 15 min) required to register. |
| `POST /api/auth/register` | Requires a valid `verificationToken` for that exact email, hashes the password with bcrypt, creates the user in MongoDB. |
| `POST /api/auth/login` | Verifies the password against the stored bcrypt hash, issues a `sessionToken` (JWT, 7 days) and returns basic profile info. |
| `POST /api/auth/forgot-password` | If the email is registered, generates a random temporary password, hashes and saves it, emails the plaintext temp password to the user. Always returns the same generic message either way, so the endpoint can't be used to check which emails are registered. |
| `GET /api/auth/me` | Requires `Authorization: Bearer <sessionToken>`. Returns the logged-in user's profile — this is what the dashboard now calls on load. |

OTP documents auto-expire out of MongoDB via a TTL index, so nothing needs a
cleanup cron job.

## Notes / things to adjust for production

- Rate limiting is in-memory (`express-rate-limit`) — fine for one server
  instance; move to a shared store (e.g. Redis) if you scale to multiple
  instances.
- `mustChangePassword` is stored on the user after a password reset but
  isn't enforced anywhere yet — add a check on login if you want to force a
  password change.
- CORS currently allows one `CLIENT_ORIGIN`. Add more origins as needed.
- Consider adding HTTPS + secure cookie-based sessions instead of
  `sessionStorage` + bearer tokens if you deploy this publicly.
