# Booking Project

Modern booking system for residential amenities (e.g., gym, BBQ, common rooms). Includes:
- Web app for users to browse amenities, see availability, and make bookings
- Admin dashboard for user management, buildings, amenities, booking restrictions, logs, and email templates
- JWT auth with refresh, SQLite (dev), NestJS API, React + Vite frontend

## Deployment (Docker Compose + Traefik)

This repository ships generic deployment files using environment placeholders. Do NOT hardcode secrets in git. On the server, provide a real `.env` file.

### Files
- `docker-compose.yml`: uses `${...}` placeholders
- `booking-api/Dockerfile`: builds and runs NestJS API
- `booking-frontend/Dockerfile`: builds Vite app, serves with nginx
- `booking-frontend/nginx.conf`: SPA fallback
- `env.example`: sample env file to copy and fill on the server

### Required environment (server-side)
**Prerequisites:** Docker and Docker Compose must be installed on the server.

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

### Post-deployment: Update Content
After deploying, log in as an admin and navigate to the Admin Dashboard → Content tab. You must update:
- **Rules and Regulations**: Customize the legal texts shown during registration and booking confirmation
- **Mail**: Update email templates for user registration and booking confirmation emails

These texts are stored in the database and should be customized for your organization before users start registering.

### Database Migrations

When deploying code changes that modify the database schema (e.g., adding new columns, tables), you must run migrations:

```bash
# Run pending migrations
docker compose exec api npm run migration:run

# Check migration status
docker compose exec api npm run migration:show
```

**⚠️ Important**: Always backup your database before running migrations in production.

See `booking-api/MIGRATIONS.md` for detailed migration documentation.

## Q&A

### How do I set up Gmail for SMTP?

Use an App Password (Gmail requires 2‑Step Verification):

1) Enable 2‑Step Verification: https://myaccount.google.com/security → “2‑Step Verification”.

2) Create App Password: on the same page, open “App passwords” (or visit https://myaccount.google.com/apppasswords), select “Mail”, choose a device (or “Other”), click “Generate”, copy the 16‑char password.

3) Configure env:
   - `SMTP_HOST=smtp.gmail.com`
   - `SMTP_PORT=465` (SSL) or `587` (STARTTLS)
   - `SMTP_USER=your_email@gmail.com`
   - `SMTP_PASS=<APP_PASSWORD>`
   - `SMTP_FROM=your_email@gmail.com`
   - `FRONTEND_URL=https://APP_HOST`

4) Test: trigger registration or a booking to verify delivery.

Tips: If “App passwords” is missing, enable 2SV first or check Workspace admin policies. Ensure outbound 465/587 is allowed. For higher volume, consider SES/SendGrid/Mailgun.

## Docker Deployment (Compose + Traefik)

This repository ships generic deployment files using environment placeholders. Do NOT hardcode secrets in git. On the server, provide a real `.env` file.

### Files
- `docker-compose.yml`: uses `${...}` placeholders
- `booking-api/Dockerfile`: builds and runs NestJS API
- `booking-frontend/Dockerfile`: builds Vite app, serves with nginx
- `booking-frontend/nginx.conf`: SPA fallback
- `env.example`: sample env file to copy and fill on the server

### Required environment (server-side)
**Prerequisites:** Docker and Docker Compose must be installed on the server.

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

### Post-deployment: Update Content
After deploying, log in as an admin and navigate to the Admin Dashboard → Content tab. You must update:
- **Rules and Regulations**: Customize the legal texts shown during registration and booking confirmation
- **Mail**: Update email templates for user registration and booking confirmation emails

These texts are stored in the database and should be customized for your organization before users start registering.


