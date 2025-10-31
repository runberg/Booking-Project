# Booking Project - Deployment and Configuration Notes

## Gmail App Password Setup (for SMTP)

Follow these steps to enable Gmail SMTP with an App Password (required by Google; legacy "Less Secure Apps" is deprecated):

1. Enable 2-Step Verification
   - Go to `https://myaccount.google.com/security` while signed in.
   - Under "How you sign in to Google", click "2-Step Verification" and complete setup.

2. Generate an App Password
   - Return to `https://myaccount.google.com/security`.
   - On the 2-Step Verification page, find "App passwords".
   - If you don't see "App passwords", see Troubleshooting below or try to go direction to `https://myaccount.google.com/apppasswords`.
   - Click "App passwords" → Select app: "Mail" → Select device: choose your device or "Other (Custom name)".
   - Click "Generate". Copy the 16-character App Password (no spaces).

3. Configure your server/application
   - Use these values (example for Docker Compose environment):
     - `SMTP_HOST=smtp.gmail.com`
     - `SMTP_PORT=465` (SSL) or `587` (STARTTLS)
     - `SMTP_USER=your_email@gmail.com`
     - `SMTP_PASS=<YOUR_16_CHAR_APP_PASSWORD>`
     - `SMTP_FROM=your_email@gmail.com` (or an allowed alias)
     - `FRONTEND_URL=https://app.yourdomain` (for links in emails)

4. Test sending
   - Trigger an email from the app (e.g., registration or booking confirmation) and confirm delivery.

### Troubleshooting
- "App passwords" not visible:
  - 2-Step Verification isn't enabled; complete 2SV first and refresh the page.
  - Advanced Protection is enabled on the account (App Passwords not supported).
  - Google Workspace: your admin may have disabled App Passwords; ask the admin to allow them or set up an SMTP relay.
- Can't send mail:
  - Verify outbound port 465/587 is allowed by your server/network.
  - Check SMTP_USER/SMTP_PASS and from-address.
  - Gmail/Workspace sending limits apply; for higher volumes, consider a dedicated email provider (SES, SendGrid, Mailgun).

## Docker Deployment (Compose + Traefik)

This repository ships generic deployment files using environment placeholders. Do NOT hardcode secrets in git. On the server, provide a real `.env` file.

### Files
- `docker-compose.yml`: uses `${...}` placeholders
- `booking-api/Dockerfile`: builds and runs NestJS API
- `booking-frontend/Dockerfile`: builds Vite app, serves with nginx
- `booking-frontend/nginx.conf`: SPA fallback
- `env.example`: sample env file to copy and fill on the server

### Required environment (server-side)
Copy `env.example` to `.env.production` (or `.env`) and fill in:

```
APP_HOST=app.example.com
LE_EMAIL=admin@example.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
SMTP_FROM=your_email@gmail.com
# Optional build-time absolute URL; otherwise app calls relative /api
# VITE_API_BASE_URL=https://app.example.com/api
```

### Start services
```
docker compose --env-file .env.production build
docker compose --env-file .env.production up -d
```

Traefik terminates TLS and routes both frontend and backend on the same host:
- Web: https://APP_HOST
- API: https://APP_HOST/api (Traefik strips the /api prefix to the API container)

### Notes
- The frontend uses `/api` by default. If you prefer absolute URLs, set `VITE_API_BASE_URL` at build-time.
- CORS in API is controlled by `CORS_ORIGIN` (set automatically to `https://APP_HOST` by compose).
- SQLite database is persisted in the `db_data` volume at `/data/booking.db` inside the API container.


