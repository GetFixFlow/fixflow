<p align="center">
  <img src="docs/logo.png" alt="FixFlow logo" width="220">
</p>

# FixFlow CMMS

> Open-source Computerized Maintenance Management System — self-hostable, IoT-ready, built for the teams that enterprise software forgot.

**v0.1** · Rails 8 API · React 18 PWA · PostgreSQL · Redis

## Tech Stack

| Layer | Technology |
|---|---|
| **API** | Ruby on Rails 8 (API mode) |
| **Frontend** | React 18 + TypeScript + Vite + Tailwind CSS |
| **Database** | PostgreSQL 16 |
| **Cache / Jobs** | Redis 7 + Sidekiq |
| **File Storage** | MinIO (S3-compatible) |
| **Auth** | Devise + devise-jwt (Bearer JWT) |
| **State** | TanStack Query v5 + Zustand v5 |
| **IoT** | REST webhook + MQTT ingestion |

---

## Quick Start (Docker — recommended)

```bash
git clone https://github.com/GetFixFlow/fixflow.git
cd fixflow
cp .env.example .env
# Edit .env — set RAILS_MASTER_KEY and DEVISE_JWT_SECRET_KEY at minimum
docker compose up -d
docker compose exec api bundle exec rails db:create db:migrate db:seed
```

The API will be available at `http://localhost:3000`.
MinIO console: `http://localhost:9001` (user: minioadmin / minioadmin)

### Demo data

To try FixFlow with a sample company (assets, work orders, PM schedules, IoT rules and sensor readings):

```bash
docker compose exec api rails fixflow:demo_data     # or: make demo-data
```

It works in any environment, but only on an install with no company of its own: it refuses once a real company exists. It creates accounts such as `admin@demo.com` with the password `password123`, so in production it asks for `CONFIRM=yes`. `rails db:seed` loads the same data in development only. Setting `SEED_DB=true` loads it when the API container starts.

Loading demo data counts as setting the install up, so the first-run screen below is skipped. Skip this step if you want to start with your own company.

### First-run setup

Each FixFlow install serves one company. Open the web app and, on a new install, it shows **Set up FixFlow**: enter your company name and the first administrator's details. Once that is done, public sign-up is closed (`POST /api/v1/auth/sign_up` returns `403`) and the login page no longer offers it.

### Adding users

Administrators add people from **Settings → Users → Invite User**. Choose a role and FixFlow creates an invitation link. If email is set up (`SMTP_HOST` and `SMTP_PASSWORD`), the link is also emailed; if not, the dialog tells you and you copy the link and send it yourself. The person opens the link, chooses a password and signs in. A link works once and expires after 7 days; use **Copy invite link** on a pending user in the Users list to make a new one.

Set `APP_URL` to the address your web app is served from, so invitation links point to the right place.

### Forgotten passwords

On the sign-in screen, **Forgot your password?** emails a reset link (if email is set up). If your server cannot send email, an administrator opens **Settings → Users → ⋯ → Reset Password**, copies the link and gives it to the person; the link works once and expires after 6 hours. The person's current password keeps working until they use the link. Using it signs them out everywhere.

---

## Local Development (without Docker)

### Prerequisites
- Ruby 3.3+
- Node.js 20+
- PostgreSQL 16
- Redis 7
- Bundler 2.5+

### API (Rails)

```bash
git clone https://github.com/GetFixFlow/fixflow.git
cd fixflow
bundle install
cp .env.example .env
# Edit .env with your local Postgres/Redis credentials

bundle exec rails db:create db:migrate
bundle exec rails db:seed     # optional: seeds demo data

bundle exec rails server      # API on :3000
bundle exec sidekiq           # Background workers
```

### Frontend (React)

```bash
cd apps/web
npm install --legacy-peer-deps
cp .env.example .env.local
# Set VITE_API_URL=http://localhost:3000/api/v1

npm run dev     # Dev server on :3001
```

### Frontend Environment Variables

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | `http://localhost:3000/api/v1` | Rails API base URL |
| `VITE_WS_URL` | `ws://localhost:3000/cable` | ActionCable WebSocket URL |
| `VITE_APP_ENV` | `development` | Application environment |

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `RAILS_MASTER_KEY` | Yes | From `config/master.key` |
| `DEVISE_JWT_SECRET_KEY` | Yes | Random 64-char hex string |
| `DATABASE_URL` | Docker only | Full PostgreSQL URL |
| `DB_HOST / DB_USERNAME / DB_PASSWORD` | Local | PostgreSQL connection |
| `REDIS_URL` | Yes | Redis connection URL |
| `IOT_API_KEY` | Yes | API key for IoT sensor ingestion |
| `CORS_ORIGINS` | Yes | Comma-separated allowed origins |
| `MINIO_ENDPOINT` | Yes | MinIO/S3 endpoint |
| `MINIO_ACCESS_KEY_ID` | Yes | MinIO access key |
| `MINIO_SECRET_ACCESS_KEY` | Yes | MinIO secret key |

Generate secrets:
```bash
# DEVISE_JWT_SECRET_KEY
ruby -e "require 'securerandom'; puts SecureRandom.hex(64)"

# IOT_API_KEY
ruby -e "require 'securerandom'; puts SecureRandom.hex(32)"
```

---

## API Overview

All endpoints are under `/api/v1/`. Authentication uses JWT Bearer tokens.

### Auth
| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/auth/login` | Login — returns JWT in `Authorization` header |
| DELETE | `/api/v1/auth/logout` | Logout — revokes JWT |
| POST | `/api/v1/auth/signup` | Create user (admin only) |

### Core Resources
| Resource | Endpoint |
|---|---|
| Health | `GET /api/v1/health` |
| Assets | `/api/v1/assets` |
| Work Orders | `/api/v1/work_orders` |
| PM Schedules | `/api/v1/pm_schedules` |
| Locations | `/api/v1/locations` |
| Parts | `/api/v1/parts` |
| IoT Rules | `/api/v1/iot_rules` |
| Users | `/api/v1/users` |

### IoT Ingestion (no JWT, uses API key)
```bash
POST /api/v1/iot/ingest
Headers: X-API-Key: <IOT_API_KEY>
Body: {
  "asset_id": 1,
  "readings": { "temperature": 72.4, "vibration": 3.2 },
  "timestamp": "2026-05-03T10:00:00Z"
}
```

### MQTT
Devices publish to: `fixflow/assets/{asset_id}/telemetry`
Payload: `{ "temperature": 72.4, "vibration": 3.2, "timestamp": "..." }`

---

## Work Order Status Flow

```
open → in_progress → pending_parts → in_progress
                  |
                  v
              completed → verified
```

---

## Branding

**Settings → Branding** (administrators) puts the company's own look on the install: a **logo** (shown in the sidebar and on the sign-in page), a **favicon**, one **primary colour** that restyles the whole app (buttons, links, highlights), and the **headline and subtitle** on the sign-in page. The colour is shown on the page as you pick it, and it must be dark enough for white text to be readable on it (the page tells you if it is not). Logos are PNG, JPEG or WebP up to 2 MB; favicons PNG or ICO up to 512 KB. SVG is not accepted, as it can carry scripts. The branding is public by design, because the sign-in page needs it before anyone has signed in.

## Working offline

A technician who loses signal can keep going. With no connection, **Start work, Put on hold, Waiting for parts, Resume and Complete**, **comments** and **photos and documents**, are saved on the phone, shown straight away with a *Waiting to sync* badge, and sent in order when the connection returns. The status at the top of the screen shows what is waiting. If the server refuses a change (for example, the work order was reassigned meanwhile), it is listed there with the reason instead of disappearing. Changes belong to the person who made them, so a shared phone keeps each person's separate.

Photos are shrunk to at most 1600 pixels on a side before they are kept or sent, so they are quick to upload and small to store on the phone; a photo that cannot be sent stays on the phone until it can, and anything over 10 MB or not a photo, PDF or Word document is refused with the reason.

Things that need the server's decision (assigning, verifying, rejecting, cancelling, editing a work order) still need a connection.

To reopen a page you already visited while offline, the app must be served over **HTTPS** (browsers only allow the offline cache on secure addresses; `localhost` counts). On a plain `http://` address the offline cache is not available: changes made while the page stays open are still saved and sent, but reloading the page offline will not work.

## Architecture

```
IoT Devices ──MQTT/REST──► FixFlow API (Rails 8)
                                  |
                    +─────────────+─────────────+
                    |             |             |
              PostgreSQL       Redis          MinIO
             (core data)    (Sidekiq)    (file storage)
```

**Stack:**
- **API**: Ruby on Rails 8, API mode
- **Auth**: Devise + devise-jwt (Bearer JWT)
- **Jobs**: Sidekiq + Redis
- **Storage**: ActiveStorage → MinIO (S3-compatible)
- **IoT**: REST webhook + MQTT-compatible ingestion
- **Serialization**: Blueprinter
- **Pagination**: Pagy

---

## Running Tests

### API (RSpec)

```bash
bundle exec rspec
bundle exec rspec spec/requests/   # request specs only
bundle exec rspec spec/models/     # model specs only
```

### Frontend (Vitest)

```bash
cd apps/web
npm run test          # run all tests
npm run test:ui       # Vitest UI
npm run test:coverage # coverage report
```

---

## Roles and Permissions

| Action | Admin | Manager | Technician | Requester |
|---|---|---|---|---|
| Create users | Yes | No | No | No |
| Manage PM schedules | Yes | Yes | No | No |
| Assign work orders | Yes | Yes | No | No |
| Update work orders | Yes | Yes | Yes (own) | No |
| Submit work requests | Yes | Yes | Yes | Yes |
| View assets | Yes | Yes | Yes | No |

---

## Development Roadmap

- **v0.1** (current) — Core CMMS loop: assets, work orders, PM, IoT ingestion
- **v0.2** — Anomaly detection, auto-prioritization
- **v0.3** — Predictive maintenance (RUL estimation)
- **v0.4** — Natural language work order creation

---

## License

AGPLv3 — see [LICENSE](LICENSE).
