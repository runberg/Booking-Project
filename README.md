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

```bash
# Domain and TLS
APP_HOST=app.example.com  # Single domain for both frontend and API (path-based routing)
LE_EMAIL=admin@example.com

# Timezone (e.g., Asia/Dubai, Europe/Copenhagen, America/New_York)
# See https://en.wikipedia.org/wiki/List_of_tz_database_time_zones for valid values
TZ=UTC

# Admin User (automatically created on first startup if not exists)
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=your_secure_admin_password_here

# JWT Configuration (generate secure random strings)
# Generate with: openssl rand -base64 32 (run twice for two different secrets)
JWT_SECRET=your_super_secret_jwt_key_here_make_it_long_and_random
JWT_REFRESH_SECRET=your_super_secret_refresh_jwt_key_here_make_it_long_and_random

# SMTP (Gmail example)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
SMTP_FROM=your_email@gmail.com

# Optional build-time absolute URL; otherwise app calls relative /api
# VITE_API_BASE_URL=https://app.example.com/api
```

**Generating JWT Secrets:**
```bash
# Generate JWT_SECRET
openssl rand -base64 32

# Generate JWT_REFRESH_SECRET (run again for a different value)
openssl rand -base64 32
```

**Password Security:** All passwords (including admin passwords) are automatically hashed using bcrypt before storage in the database. The admin password set in `ADMIN_PASSWORD` is hashed when the admin user is created. User passwords are also hashed during registration and password resets.

### Start services
```bash
docker compose --env-file .env.production build
docker compose --env-file .env.production up -d
```

Or if using `.env` (recommended):
```bash
docker compose build
docker compose up -d
```

Traefik terminates TLS and routes both frontend and backend on the same domain using path-based routing:
- Web: `https://APP_HOST` (e.g., `https://app.example.com`)
- API: `https://APP_HOST/api` (Traefik strips the `/api` prefix before forwarding to the API container)

**DNS Setup:** Only one A record is needed: `APP_HOST` → your server IP.

### Updating/Restarting Services

**After pulling code changes:**
```bash
# Pull latest changes
git pull origin main

# Rebuild and restart (Traefik will automatically wait for API to be healthy)
docker compose build --no-cache api web
docker compose up -d

# Or restart just the API if only backend changed:
docker compose build --no-cache api
docker compose restart api proxy  # Restart proxy to rediscover API
```

**⚠️ Important:** If you rebuild the API container, always restart both `api` and `proxy` together to ensure Traefik rediscoveries the API on the correct network. The `depends_on` configuration ensures Traefik waits for the API to be healthy, but restarting both prevents network discovery issues.

**Check service status:**
```bash
# View all containers
docker compose ps

# Check API logs
docker compose logs -f api

# Check Traefik logs
docker compose logs -f proxy

# Test API connectivity
docker compose exec proxy wget -q -O- --timeout=5 http://api:3000/health
```

### Notes
- The frontend uses relative `/api` path by default (no separate domain needed).
- CORS in API is controlled by `CORS_ORIGIN` (set automatically to `https://APP_HOST` by compose).
- **Database:** SQLite database is persisted in the `./data` directory on the host (bind mount) at `./data/booking.db`. This makes it easy to backup and access directly.
- **Auto-migrations:** Database migrations run automatically on container startup in production. Fresh databases will be initialized automatically using synchronize.

### Post-deployment: Update Content
After deploying, log in as an admin and navigate to the Admin Dashboard → Content tab. You must update:
- **Rules and Regulations**: Customize the legal texts shown during registration and booking confirmation
- **Mail**: Update email templates for user registration and booking confirmation emails

These texts are stored in the database and should be customized for your organization before users start registering.

### Database Migrations

**Automatic Migrations:** In production, migrations run automatically on container startup. When you deploy code changes that modify the database schema, the migrations will be applied automatically when the container restarts.

**Manual Migration Commands** (if needed):
```bash
# Run pending migrations manually
docker compose exec api npm run migration:run:prod

# Check migration status
docker compose exec api npm run migration:show
```

**⚠️ Important**: Always backup your database before deploying schema changes:
```bash
# Backup database (located at ./data/booking.db)
cp ./data/booking.db ./data/booking.db.backup-$(date +%Y%m%d-%H%M%S)
```

**Fresh Installations:** For fresh deployments, the database will be automatically initialized using synchronize (tables created from entities). Once the database exists, synchronize is disabled and migrations take over.

See `booking-api/MIGRATIONS.md` for detailed migration documentation.

## Q&A

### How do I set up Gmail for SMTP?

Use an App Password (Gmail requires 2‑Step Verification):

1) Enable 2‑Step Verification: https://myaccount.google.com/security → "2‑Step Verification".

2) Create App Password: on the same page, open "App passwords" (or visit https://myaccount.google.com/apppasswords), select "Mail", choose a device (or "Other"), click "Generate", copy the 16‑char password.

3) Configure env:
   - `SMTP_HOST=smtp.gmail.com`
   - `SMTP_PORT=465` (SSL) or `587` (STARTTLS)
   - `SMTP_USER=your_email@gmail.com`
   - `SMTP_PASS=<APP_PASSWORD>`
   - `SMTP_FROM=your_email@gmail.com`
   - `FRONTEND_URL=https://APP_HOST`

4) Test: trigger registration or a booking to verify delivery.

Tips: If "App passwords" is missing, enable 2SV first or check Workspace admin policies. Ensure outbound 465/587 is allowed. For higher volume, consider SES/SendGrid/Mailgun.