# Booking System

A self-hosted amenity booking platform for residential buildings. Residents book facilities (gym, badminton, BBQ area, etc.) through a web app. Administrators manage users, buildings, amenities, booking restrictions, and review logs.

## Stack

| Layer | Technology |
|---|---|
| API | NestJS 11 (Fastify adapter) |
| Frontend | React 19 + Vite, served by nginx |
| Database | PostgreSQL 16 |
| Edge proxy | Traefik v3 (shared with other services on the host) |

Images are built by GitHub Actions and published to GHCR:
- `ghcr.io/runberg/booking-project/api:latest`
- `ghcr.io/runberg/booking-project/frontend:latest`

---

## Deployment

### Step 1 — Traefik shared proxy (one-time per server)

All Docker projects on the server share a single Traefik instance that owns ports 80/443. If Traefik is already running, skip to Step 2.

**Create the directory and required files:**

```bash
mkdir ~/traefik && cd ~/traefik
mkdir letsencrypt dynamic
touch letsencrypt/acme.json && chmod 600 letsencrypt/acme.json
```

`chmod 600` on `acme.json` is mandatory — Traefik refuses to start if the file has loose permissions.

**Create `~/traefik/docker-compose.yml`:**

```yaml
services:
  traefik:
    image: traefik:v3.0
    container_name: traefik
    command:
      - --providers.docker=true
      - --providers.docker.exposedByDefault=false
      - --providers.file.directory=/etc/traefik/dynamic
      - --providers.file.watch=true
      - --entrypoints.web.address=:80
      - --entrypoints.websecure.address=:443
      - --entrypoints.traefik.address=:8080
      - --certificatesresolvers.le.acme.tlschallenge=true
      - --certificatesresolvers.le.acme.email=you@yourdomain.com
      - --certificatesresolvers.le.acme.storage=/letsencrypt/acme.json
      - --api.dashboard=true
      - --ping=true
      - --ping.entrypoint=traefik
    ports:
      - "80:80"
      - "443:443"
      # Uncomment only if you need host-level dashboard access (keep firewalled):
      # - "8080:8080"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./letsencrypt:/letsencrypt
      - ./dynamic:/etc/traefik/dynamic
    labels:
      - traefik.enable=true
      - traefik.http.routers.dashboard.entrypoints=traefik
      - traefik.http.routers.dashboard.service=api@internal
      - traefik.http.routers.dashboard.middlewares=dashboard-auth
      # Generate the password hash: htpasswd -nB admin  (escape $ as $$ in yaml)
      - traefik.http.middlewares.dashboard-auth.basicauth.users=admin:$$2y$$05$$...
      # Global HTTP → HTTPS redirect for all domains
      - traefik.http.middlewares.redirect-to-https.redirectscheme.scheme=https
      - traefik.http.routers.http-catchall.rule=HostRegexp(`{host:.+}`)
      - traefik.http.routers.http-catchall.entrypoints=web
      - traefik.http.routers.http-catchall.middlewares=redirect-to-https
    networks:
      - traefik-proxy
    restart: unless-stopped

networks:
  traefik-proxy:
    name: traefik-proxy
```

**Start Traefik:**

```bash
docker compose up -d
```

Traefik creates the `traefik-proxy` Docker network automatically. Every project on the server joins this network as an **external** network — they never manage it themselves.

---

### Step 2 — Deploy the Booking System

```bash
mkdir booking-project && cd booking-project
curl -O https://raw.githubusercontent.com/runberg/Booking-Project/main/docker-compose.yml
curl -O https://raw.githubusercontent.com/runberg/Booking-Project/main/env.example
cp env.example .env
```

Edit `.env` — required fields:

```env
DOMAIN=booking.yourdomain.com

POSTGRES_PASSWORD=a_strong_random_password

JWT_SECRET=<openssl rand -base64 32>
JWT_REFRESH_SECRET=<openssl rand -base64 32>

ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=change_after_first_login

FRONTEND_URL=https://booking.yourdomain.com
CORS_ORIGIN=https://booking.yourdomain.com
```

```bash
docker compose up -d
```

Traefik detects the container via Docker labels, issues a Let's Encrypt certificate for `DOMAIN`, and begins routing. The app is live at `https://booking.yourdomain.com` within a minute or two.

**On first start**, the API creates an admin account using `ADMIN_EMAIL` / `ADMIN_PASSWORD` if no admin exists yet.

---

### Updating

GitHub Actions builds a new image on every push to `main`. Pull and redeploy on the server:

```bash
docker compose pull
docker compose up -d
```

---

### Useful commands

```bash
# Status
docker compose ps

# Live logs
docker compose logs -f api
docker compose logs -f web
```

---

### Backup and restore

Everything unique to your installation lives in three places:

| What | Why |
|---|---|
| `./data/postgres/` | The entire database — users, bookings, settings, logs, etc. |
| `docker-compose.yml` | Service configuration |
| `.env` | Secrets and environment variables |

#### Taking a backup

The recommended way is a live `pg_dump`. This is safe while the system is running and produces a clean SQL file:

```bash
docker compose exec postgres pg_dump -U booking booking > backup-$(date +%Y%m%d).sql
```

Store the resulting `.sql` file (plus your `.env`) somewhere safe. That is all you need to fully restore the system on any server.

> **Do not** copy the `./data/postgres/` folder while the database container is running — Postgres may have partially written files, which can result in a corrupt backup. If you want a folder-level copy, stop the container first:
> ```bash
> docker compose stop postgres
> cp -r ./data/postgres ./data/postgres.bak
> docker compose start postgres
> ```

#### Restoring from a pg_dump backup

```bash
# Start a fresh stack (no existing data folder)
docker compose up -d

# Wait for Postgres to be healthy, then restore
docker compose exec -T postgres psql -U booking booking < backup-20240101.sql
```

#### Restoring from a folder-level backup

If you have a cold copy of `./data/postgres/`, place it at `./data/postgres/` before starting the stack — Postgres will pick it up automatically on first start:

```bash
cp -r /your/backup/postgres ./data/postgres
docker compose up -d
```

---

## Hooking other projects into the same Traefik instance

Any project on the server follows the same pattern. The three requirements are:

1. Declare `traefik-proxy` as an **external** network.
2. Put the publicly-accessible container on both `traefik-proxy` (so Traefik can reach it) and `internal` (so it can reach its own database/services).
3. Add the four Traefik labels.

**Template:**

```yaml
services:

  traefik-ready:
    image: curlimages/curl:latest
    command: >
      sh -c "
        for i in $(seq 1 ${TRAEFIK_PING_RETRIES:-10}); do
          curl -fsS ${TRAEFIK_PING_URL:-http://traefik:8080/ping} && exit 0
          echo 'waiting for Traefik...'; sleep ${TRAEFIK_PING_DELAY_SECONDS:-3};
        done; exit 1
      "
    restart: "no"
    networks:
      - traefik-proxy

  app:
    image: myapp:latest
    labels:
      - traefik.enable=true
      - traefik.docker.network=traefik-proxy
      - traefik.http.routers.myapp.rule=Host(`myapp.yourdomain.com`)
      - traefik.http.routers.myapp.entrypoints=websecure
      - traefik.http.routers.myapp.tls.certresolver=le
      - traefik.http.services.myapp.loadbalancer.server.port=80
    depends_on:
      traefik-ready:
        condition: service_completed_successfully
    networks:
      - traefik-proxy   # Traefik routes here
      - internal        # App reaches its database here

  db:
    image: postgres:16-alpine
    networks:
      - internal        # Never on traefik-proxy

networks:
  traefik-proxy:
    external: true      # Owned by the Traefik stack, shared across all projects
  internal:
    driver: bridge      # Private to this project
```

**Label reference:**

| Label | Purpose |
|---|---|
| `traefik.enable=true` | Opt in (required because `exposedByDefault=false`) |
| `traefik.docker.network=traefik-proxy` | Which network Traefik uses to reach the container (needed when container is on multiple networks) |
| `traefik.http.routers.<name>.rule=Host(...)` | Domain routing rule |
| `traefik.http.routers.<name>.entrypoints=websecure` | HTTPS only (HTTP→HTTPS redirect is handled globally by Traefik) |
| `traefik.http.routers.<name>.tls.certresolver=le` | Automatic Let's Encrypt certificate |
| `traefik.http.services.<name>.loadbalancer.server.port=PORT` | The internal port the container listens on |

The `traefik-ready` service verifies Traefik is reachable before the app container starts. `depends_on: condition: service_completed_successfully` blocks the app until the check passes.

---

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DOMAIN` | Yes | — | Public hostname, e.g. `booking.yourdomain.com` |
| `POSTGRES_USER` | No | `booking` | Database username |
| `POSTGRES_PASSWORD` | Yes | — | Database password |
| `POSTGRES_DB` | No | `booking` | Database name |
| `JWT_SECRET` | Yes | — | Access token signing secret (`openssl rand -base64 32`) |
| `JWT_REFRESH_SECRET` | Yes | — | Refresh token signing secret (must differ from `JWT_SECRET`) |
| `ADMIN_EMAIL` | Yes | — | Initial admin account email |
| `ADMIN_PASSWORD` | Yes | — | Initial admin account password |
| `FRONTEND_URL` | Yes | — | Full app URL, e.g. `https://booking.yourdomain.com` (used in emails) |
| `CORS_ORIGIN` | Yes | — | Allowed CORS origin — should match `FRONTEND_URL` |
| `TZ` | No | `UTC` | Timezone for the API container |

---

## Before going live

After the first deployment, log in as admin and complete all three steps below before sharing the system with residents. The admin dashboard will show a warning banner for each item that is not yet configured.

### 1. Configure email (required for user registration)

Go to **Admin → Settings** and enter your SMTP details. Without a working mail configuration, residents cannot self-register because their account verification email will never be sent.

See [SMTP with Gmail](#smtp-with-gmail) below for a step-by-step example.

### 2. Add buildings and units (required for registration)

Go to **Admin → Buildings and Units** and:
1. Create each building by name.
2. Expand the building and paste in its apartment/unit numbers (one per line or comma-separated).
3. Save the units — the building can then be activated.

Only **active** buildings appear on the registration page. A building cannot be activated until it has at least one unit number added.

### 3. Add and activate amenities (required for bookings)

Go to **Admin → Amenities** and create each bookable facility (gym, BBQ area, etc.). Set opening hours and the booking slot length, then mark it as active. Until at least one amenity is active, residents will see an empty booking page.

---

### Optional post-deployment steps

Visit **Admin → Content** to customise:
- Rules and Regulations text shown during registration and booking
- Email templates for booking confirmations and account emails

---

## SMTP with Gmail

Gmail requires an App Password (needs 2-Step Verification enabled):

1. Enable 2-Step Verification at [myaccount.google.com/security](https://myaccount.google.com/security).
2. Create an App Password at [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords) — select "Mail", copy the 16-character password.
3. In the admin dashboard go to **Settings** and fill in:
   - SMTP Host: `smtp.gmail.com`
   - SMTP Port: `587`
   - SMTP Username: `your_email@gmail.com`
   - SMTP Password: the 16-character app password
   - From Address: `your_email@gmail.com`

---

## Local development

**API** (requires a local PostgreSQL instance):

```bash
cd booking-api
cp .env.example .env   # set DATABASE_URL to your local Postgres
npm install
npm run start:dev      # http://localhost:3000
```

**Frontend:**

```bash
cd booking-frontend
npm install
npm run dev            # http://localhost:5173, proxies /api → localhost:3000
```
