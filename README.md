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
| **File Storage** | Any S3-compatible server (SeaweedFS in the Docker install) |
| **Auth** | Devise + devise-jwt (Bearer JWT) |
| **State** | TanStack Query v5 + Zustand v5 |
| **IoT** | REST webhook + MQTT ingestion |

---

## Install on a server (Docker)

You need a Linux (or macOS) machine with Docker and Docker Compose v2, about 2 GB of memory, and a few GB of disk. Nothing else is installed on it: the database, Redis, the file storage and the sensor broker all run in containers.

```bash
git clone https://github.com/GetFixFlow/fixflow.git
cd fixflow
cp .env.example .env
# Fill in the "Required" block of .env. Every line has the command beside it that makes its value (openssl rand -hex 24 ...).
docker compose -f docker-compose.prod.yml up -d --build      # or: make prod
```

The first start builds the two images on the server (about 5 to 10 minutes) and pulls the rest. Then open the address you put in `APP_URL`: a new install shows **Set up FixFlow** (see *First-run setup* below). `docker compose -f docker-compose.prod.yml ps` shows seven services, all `healthy`: `web`, `api`, `sidekiq`, `db`, `redis`, `mqtt` and `s3`.

- **One front door.** `web` serves the web app and passes `/api` and `/cable` (live updates) on to the API. It listens on `HTTP_PORT` (80 unless you set another; put the port in `APP_URL` if it is not 80). The sensor broker is on port 1883. **Nothing else is published**: the database, Redis, the file storage and the API can only be reached from inside.
- **No HTTPS yet.** The front door speaks plain HTTP, so sign-in tokens cross your network unencrypted: use it on a network you trust until you put a TLS proxy in front (your company's, or Caddy, Traefik and the like; it must send `X-Forwarded-Proto: https`, which the front door passes on). Built-in HTTPS is on the roadmap.
- **File storage** is [SeaweedFS](https://github.com/seaweedfs/seaweedfs) speaking the S3 protocol (the `MINIO_*` settings keep their old names and work for any S3-compatible server; MinIO's own image can no longer be pulled).
- **Settings.** Everything in `.env` reaches the API and the worker, so any setting in the table below can be added there. If a required one is missing, `docker compose` says which.
- **Data lives in four volumes** (`postgres_data`, `redis_data`, `s3_data`, `mqtt_data`); `docker compose ... down` keeps them, `down -v` deletes them. Back up as described under *Backups and restoring*.
- **Commands.** Commands in this README that start with `docker compose exec api rails ...` are written for the development stack; on a production install they are `docker compose -f docker-compose.prod.yml exec api bin/rails ...`. `make prod`, `make prod-status`, `make prod-logs`, `make prod-stop`, `make backup` and `make restore` wrap the common ones.

### Development with Docker

```bash
docker compose up -d       # the API, a worker, PostgreSQL, Redis and an S3 server, with no configuration
docker compose exec api bundle exec rails db:create db:migrate db:seed
```

The API is on `http://localhost:3000` and the S3 server on `http://localhost:8333` (login `minioadmin` / `minioadmin`). The web app is run with npm; see *Local Development*. This is a different stack from the production one (`docker-compose.yml` and `docker-compose.prod.yml` are not combined) and uses public, development-only secrets.

### Sample data and the first steps

On an install that is yours already, **sample data** lets an administrator look around a FixFlow that has something in it: **Settings, Import / Export, Sample data**, the **Add sample data** link on the dashboard's Getting started card, or `bin/rails fixflow:sample_data`. It adds a few places, assets, parts, a PM schedule (with a checklist to tick), open and finished work orders and some history, all named "Sample: …". It creates **no accounts and sends no email**. Take it out again with **Remove sample data** (or `bin/rails fixflow:remove_sample_data`): only the sample items go. Anything you added is untouched, and a sample item you have since built on (a work order on a sample asset, say) is **kept and listed**, as it is yours now.

New administrators also see a **Getting started** card on the dashboard with three first steps (add equipment, create a work order, invite your team) that tick off from what is really in the install. Sample data does not count. It can be put away with the cross, and goes by itself when all three are done.

### Demo company (trial installs)

For a trial install with nothing in it, to try FixFlow with a whole sample company (assets, work orders, PM schedules, IoT rules and sensor readings):

```bash
docker compose exec api rails fixflow:demo_data     # or: make demo-data
```

It works in any environment, but only on an install with no company of its own: it refuses once a real company exists. It creates accounts such as `admin@demo.com` with the password `password123`, so in production it asks for `CONFIRM=yes`. `rails db:seed` loads the same data in development only. Setting `SEED_DB=true` loads it when the API container starts.

Loading demo data counts as setting the install up, so the first-run screen below is skipped. Skip this step if you want to start with your own company.

### First-run setup

Each FixFlow install serves one company. Open the web app and, on a new install, it shows **Set up FixFlow**: enter your company name and the first administrator's details. Once that is done, public sign-up is closed (`POST /api/v1/auth/sign_up` returns `403`) and the login page no longer offers it.

### Adding users

Administrators add people from **Settings → Users → Invite User**. Choose a role and FixFlow creates an invitation link. If email is set up (see [Email](#email)), the link is also emailed; if not, the dialog tells you and you copy the link and send it yourself. The person opens the link, chooses a password and signs in. A link works once and expires after 7 days; use **Copy invite link** on a pending user in the Users list to make a new one.

Set `APP_URL` to the address your web app is served from, so invitation links point to the right place.

### Forgotten passwords

On the sign-in screen, **Forgot your password?** emails a reset link (if email is set up). If your server cannot send email, an administrator opens **Settings → Users → ⋯ → Reset Password**, copies the link and gives it to the person; the link works once and expires after 6 hours. The person's current password keeps working until they use the link. Using it signs them out everywhere.

### Where you are signed in

**Settings → My Profile → Where you are signed in** lists every browser or phone signed in to your account, with the device (for example "Chrome on macOS"), its address, and when it was last used, and lets you sign out of any one of them or of all the others. Use it when you used a shared computer, lost a phone, or see a device you do not recognise. A session lasts 24 hours.

Each sign-in is its own session: **signing out ends only that one**, and your other devices stay signed in (before, signing out anywhere signed you out everywhere). **Changing your password, or an administrator deactivating your account, ends every session.** An ended session can no longer open a live-update connection, but a connection it already had open stays until the page is closed or reloaded. Ending one is written to the activity log.

The address shown is the one the server sees, so behind a proxy it is the proxy's address unless the proxy passes `X-Forwarded-For`. Nothing is looked up from it: there is no location.

**After upgrading, everyone signs in once more:** tokens made before this change have no session behind them and are no longer accepted (they would have expired within a day anyway).

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

`.env.example` lists every setting with a note on what it does. These are the ones that matter (the **Needed** column is for a production install). **The Docker install builds `DATABASE_URL`, `REDIS_URL` and the `MINIO_ENDPOINT` itself** from `DB_PASSWORD`, `REDIS_PASSWORD` and its own services; you set the passwords.

| Variable | Needed | What it is |
|---|---|---|
| `SECRET_KEY_BASE` | Yes | Signs sessions and cookies: at least 64 characters. `bin/rails secret` makes one. |
| `DEVISE_JWT_SECRET_KEY` | Yes | Signs sign-in tokens: at least 32 characters. `openssl rand -base64 64` makes one. |
| `DATABASE_URL` | Yes | `postgres://user:password@host:5432/database` |
| `REDIS_URL` | Yes | `redis://:password@host:6379/0` (background jobs, live updates) |
| `APP_URL` | Yes | Where people open FixFlow, e.g. `https://fixflow.example.com`. Used in links in emails (invitations, password resets). |
| `ALLOWED_ORIGINS` | If the web app has another address than the API | Comma-separated web addresses allowed to call the API, e.g. `https://fixflow.example.com` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD` | No | A mail server, if you do not set one under Settings, Email |
| `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET` | For file uploads | The S3-compatible file storage |
| `MQTT_HOST`, `MQTT_PORT`, `MQTT_USERNAME`, `MQTT_PASSWORD` | For IoT over MQTT | The sensor broker |
| `HTTP_PORT` | No | Docker install: the port the web front door listens on (80 if left out). Put it in `APP_URL` too when it is not 80 |
| `MQTT_SUBSCRIBER` | No | `true` or `false` decides whether this process listens to the sensor broker; by default only the background worker does, so each reading is stored once |
| `FIXFLOW_UPDATE_CHECK` | No | `false` stops the System Health page from asking GitHub for the latest release (anything else leaves it on) |
| `SKIP_CONFIG_CHECK` | No | `true` skips the start-up check below (for an emergency) |

Generate secrets:
```bash
bin/rails secret                  # SECRET_KEY_BASE
openssl rand -base64 64           # DEVISE_JWT_SECRET_KEY
```

### The server checks its settings when it starts

A production server (and the Docker entrypoint) checks the settings above before doing anything else, and **refuses to start with a plain message** when:

- `SECRET_KEY_BASE` or `DEVISE_JWT_SECRET_KEY` is missing, too short, or still the example value from `.env.example`;
- `DATABASE_URL` or `REDIS_URL` is not a valid address, or has the example password in it;
- `APP_URL`, `ALLOWED_ORIGINS`, `SMTP_PORT`, `MQTT_PORT` or `MINIO_ENDPOINT` is malformed;
- the database or Redis does not answer, or the mail server set in the environment does not answer.

Things that do not stop it but are printed as **warnings**: `APP_URL` not set (email links would point at localhost), `ALLOWED_ORIGINS` missing the web app's address, example passwords for the file storage, the MQTT broker or the mail server, `SEED_DB=true` (demo accounts with a well-known password), an AI key missing while `AI_ENABLED=true`, and the file storage or the MQTT broker not answering.

Run the same check yourself, without starting anything:

```bash
bin/rails fixflow:check_config            # settings and whether the services answer
bin/rails "fixflow:check_config[static]"  # settings only, no network
```

The Docker entrypoint also stops waiting for the database after two minutes with a message, instead of waiting for ever.

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
Headers: X-API-Key: <an API key made under Settings, API Keys>
Body: { "asset_id": 1, "metric": "temperature", "value": 72.4, "unit": "C" }
# or several readings from one device:
Body: { "asset_id": 1, "device_id": "pump-1", "timestamp": "2026-05-03T10:00:00Z",
        "readings": [ { "metric": "temperature", "value": 72.4, "unit": "C" }, { "metric": "vibration", "value": 3.2, "unit": "mm/s" } ] }
```
`asset_tag` can be used instead of `asset_id`. A body that is a list of readings, each naming its asset, is accepted too.

### MQTT
Devices connect to the broker on port 1883 with `MQTT_USERNAME` and `MQTT_PASSWORD` (a connection without them is refused) and publish to:

```
fixflow/<company token>/assets/<asset id or asset tag>/telemetry
Payload: { "metric": "temperature", "value": 72.4, "unit": "C" }
     or: { "device_id": "pump-1", "readings": [ { "metric": "vibration", "value": 3.2, "unit": "mm/s" } ] }
```

The company token is the company name in lowercase with dashes (Acme Plant is `acme-plant`); `GET /api/v1/organization_settings` shows it as `slug`. The asset can also be named in the payload (`asset_id`) on `fixflow/<company token>/telemetry`. A message that names no known asset is logged and dropped.

Exactly one process listens to the broker, the background worker: the broker hands every subscriber every message, so a second listener (the web server too) would store each reading twice. `MQTT_SUBSCRIBER=true` or `false` overrides which process it is, for a server with no worker.

---

## Work Order Status Flow

```
open → in_progress → pending_parts → in_progress
                  |
                  v
              completed → verified
```

---

## IoT alerts and rules

**Rules** (**IoT → Rules**, managers and administrators) say when a sensor reading is a problem: a metric on an asset, a limit (or a range), how long it must last, and whether to open a work order (with a cooldown so one fault does not open a hundred). A rule can be **paused**, **resumed**, **archived** (it stops; nothing is deleted) or **duplicated** (the copy is **paused**, with fresh counts, so it does not raise a second set of alerts until you switch it on). **Test** asks "what would happen if a sensor read 91?": it answers in words (alert, work order, cooldown, paused) and shows the last five readings and which of them would have set the rule off. A rule's assignee must be an active person in your company.

**Alerts** (**IoT → Alerts**) are raised by rules. An alert's **severity** is its rule's work order priority (critical, high, medium or low). Managers and administrators can move an alert along:

| From | Can become |
| --- | --- |
| open | acknowledged, resolved, suppressed |
| acknowledged | resolved, suppressed |
| suppressed | resolved |
| resolved | nothing |

An alert that cannot make the move you ask for is refused with the reason (before, acknowledging an alert twice counted it twice against its rule). **Bulk** acknowledge and resolve take up to 200 alerts: each one that can move does, and the answer says how many were skipped (already dealt with, or not found). Each asset's own alert history is at `GET /api/v1/assets/:id/iot_alerts`.

### The IoT screens: monitor, report and live alerts

**IoT → Monitor** (everyone signed in) shows what the sensors are doing now, counted from the stored readings and alerts:

- **Active sensors**: each metric on each asset that has reported within the **stale limit** (Settings → Company, default 5 minutes); **assets monitored**: assets that reported in the last 24 hours.
- **Readings per hour**: the last 60 minutes, and the change against the 60 before that.
- **Open alerts** by severity, **active rules**, and rules that **set something off today**.
- **Asset status**: each monitored asset's latest value for each metric, whether it is past its rule's limit, how close it is (for "above" rules the reading over the limit; for "below" rules the limit over the reading), and whether the sensor has gone quiet. Assets with a metric past its limit come first; 24 are shown.
- **Readings activity**: one point per hour for the last week.

If the figures cannot be loaded the page says so and offers **Try again**; it no longer shows zeros and "All clear" in their place. "Updated … ago" is when the figures were really fetched.

**Live alerts.** While you are signed in, a new alert for your company appears as it happens: a toast for **critical** and **high** alerts (with a sound for critical, unless switched off in Settings → Notifications), the alert lists and the monitor refresh, the header bell shows a mark (click it to see the alerts and clear the mark), and the monitor shows **Live** when the connection is up. Live alerts are sent by the background worker (the one that also sends email) over a WebSocket at `/cable`; the browser sends its sign-in token in the address because a WebSocket cannot send a header. Your reverse proxy must pass WebSocket upgrades on `/cable`. A signed-out or ended session cannot connect.

**IoT → Reports → IoT Analytics** (managers and administrators) counts the alerts of the period: total, critical, still open, those with a work order, and the **share resolved** (nothing here resolves alerts by itself, so it is not an "auto-resolved" rate), a trend by day (by week for periods over 92 days) split by severity, how each rule did (alerts, work orders, share resolved, average hours to resolve), and, when one asset is chosen in the Filters, its metrics as a daily average. The Filters panel's assets, places and severities apply.

## Importing data from a spreadsheet

**Import** (managers and administrators; the Import button on Locations, Assets and Parts, or `/import`) brings **locations, assets and parts** in from a CSV file. Choose what you are importing, download its **template**, fill it in, and choose the file: it is **checked first and nothing is imported yet**. A clean file shows a preview and an Import button. A file with mistakes lists every one with its **row (as your spreadsheet numbers it), column and the problem**, and downloads as a list to work through. **If any row has a problem nothing is imported**, so after fixing the file you can upload it again without the rows that were fine being doubled up.

Do it in this order: **locations**, then assets and parts, which refer to a location by its name or by its full path (`Plant > Floor 1 > Line 2`; use the path when two places share a name). In the locations file a row can sit under one made earlier in the same file.

| Import | Columns (the first is required) | Notes |
| --- | --- | --- |
| Locations | `name`, `type`, `parent` | Type is site, building, floor, zone, room or outdoor (top level defaults to site, anything below to zone). |
| Assets | `name`, `asset_tag`, `serial_number`, `status`, `location` | Tags must be new. A blank tag is made up for you. Any other column (manufacturer, year…) is kept as a custom field. |
| Parts | `name`, `sku`, `quantity_on_hand`, `reorder_point`, `unit`, `unit_cost`, `location` | SKUs must be new. Importing parts does not trigger low-stock emails. |

The file can come straight from Excel: CSV saved by Excel (including the byte order mark, Windows line endings, Windows-1252 accents, and the semicolon separator some countries use with a decimal comma), quoted values with commas or line breaks, tab-separated text, and column headings in any case. It cannot be an `.xlsx` workbook (in Excel use File, Save As, CSV). Up to 5 MB and 5,000 rows at a time.

## Checklists

A preventive maintenance schedule can carry a **checklist** (set when you create or edit the schedule). Each work order it generates gets a copy, and the technician ticks the steps on their phone as they work. A step is **required** unless it is marked optional: the work order **cannot be completed while a required step is undone**, and the server says which ones are missing. Each tick records **who did it and when**, shown under the step, and the checklist is **locked once the work order is completed**, so what was done stays on the record. Managers can tick steps too. Ticking works **offline**: the tick is kept on the phone, marked "Waiting to sync", and sent when the connection returns (if the work order was completed in the meantime, you are told the tick was not kept).

## Labor cost

A work order's **labor cost** is the hours recorded when it is completed times an **hourly rate**: the technician's own rate if they have one, otherwise the company's default. The rate used is saved with the work order, so raising someone's rate later does not change work already done; correcting the hours works the cost out again at the current rate. Parts and labor add up to the work order's total, and the cost reports now include the labor.

Set the **default rate** in **Settings → Company** (Hourly labor rate) and, for a particular person, **Settings → Users → Edit → Hourly rate** (administrators only; leave it empty to use the default). Until a rate is set anywhere, labor counts as nothing, and the work order says so rather than guessing. Because wages are sensitive, only **managers and administrators** see labor costs and rates; technicians and requesters see the parts cost only.

## Cost reports and report filters

**Reports → Cost Analysis** shows what finished work cost: the total, labor and parts apart, the average per work order, a trend (a point per day, week or month, chosen by the length of the period), the assets that cost most, and the same by place. A cost counts **in the period the work was completed**, so a job opened last month and finished today is today's cost; only completed and verified work counts. Labor comes from [Labor cost](#labor-cost), so it needs an hourly rate to be more than nothing.

The **Filters** panel on every report now works: places (including everything inside them), assets, the people who did the work, priorities, and where the work order came from (made by hand, from a PM schedule, or from an IoT rule). Choices combine, each narrowing further.

**Reports are for managers and administrators on the server too**, not just on the screens: labor costs reveal what people are paid, so a technician or requester who calls a report directly gets "forbidden".

## What the report screens show

Each report screen reads the figures the server sends for it, and the Filters panel applies to all of them:

- **Work Orders**: the cards are the period's work orders created, the share completed, the average hours from creation to completion, and the share of those with a due date that missed it. **By Priority** gives, for each priority, what was created, completed and is still open, the average hours from start to finish, and the share overdue (finished late, or still open and past its due date). **MTTR** (mean time to repair) is the average hours from work starting to it being finished, by asset, place and technician, slowest first; work that was never started is left out. **Backlog Aging** counts what is open *now* by age (0-7, 8-14, 15-30 and over 30 days) and priority, and lists the five oldest; it follows the Filters but not the period. The **heatmap** shows work completed on each of the last 13 weeks' days; it follows the Filters but not the period. Days, weeks and months are the company's (Settings, time zone), not UTC.
- **Asset Health**: the health score and counts by status, health by place, and an **inventory** of the assets (those down or degraded first) with place, open and total work orders and open IoT alerts. The maintenance cost is the same figure as on Cost Analysis, for the same period and Filters. Clicking an asset opens its figures: total work orders, cost, average hours to finish work, PM compliance, and its last twelve months of work orders (made by a schedule or not) and IoT alerts. There is no health percentage for a single asset, because nothing defines one.
- **Technician Performance**: each person's work orders in the period and the Filters.
- **PM Compliance**: of the maintenance that came due in the period, the share completed; maintenance that was skipped, or is past its date and still not done ("missed"), counts against it, and maintenance not due yet is left out. The same definition as the PM dashboard and the main dashboard. With nothing due the rate shows "—". It is broken down by month, place and asset, and the forecast table shows what repeats how often and who has it. The assets, places and (for the forecast) people in the Filters panel apply.
- **IoT Analytics** and **Cost Analysis**: as described above; their answers are now under the same check as the others.

Report figures are counted each time you open a report; none are cached.

## The dashboard

The first screen differs by role, and the server decides what each person gets. **Managers and administrators** see the company: open and overdue work orders, asset health, PM compliance, open and critical IoT alerts, what was completed this week, schedules due this week, and recent activity. **Technicians** see their own work (assigned, in progress, overdue, completed today), the maintenance assigned to them and their own recent activity. **Requesters** see how many requests they have made, how many are still open and how many are completed. The figures are counted each time the page loads, not cached.

**PM Compliance** is the same figure as on the PM dashboard: of the maintenance that came due in the last 30 days, the share that was completed; skipped and missed ones count against it. It shows "—" when nothing came due. "Due this week" counts schedules due in the next seven days; overdue schedules are counted apart.

## System health

**Settings, System Health** (administrators only) says whether this install is working, checked live when you open it and again every 30 seconds:

- **FixFlow**: the version, the mode it runs in, how long it has been up.
- **Database** and **Redis**: whether they answer and how fast, their versions, and, for the database, whether migrations are waiting to be run.
- **Background jobs**: whether a Sidekiq worker is running (without one, emails, scheduled PM work orders, IoT alerts and the nightly jobs silently stop, so this is shown as *Down*; a worker that has just stopped can still show as running for about a minute, Sidekiq's own liveness window), how much is waiting and for how long, what is being retried, and how many jobs failed for good.
- **Email**: whether a mail server is set up (in Settings, Email, or the server's environment) and answers.
- **IoT over MQTT**: when a broker is configured, whether it answers, whether FixFlow is subscribed to it, and when the last message arrived. With no broker it says *Not set up*; sensors can still send readings over HTTP.
- **File storage**: whether uploads can be reached.
- **Updates**: whether a newer FixFlow release exists.

Each check says *Working*, *Needs attention* (works, but look at it) or *Down*, with a sentence that says what it means and what to do. The short public `GET /api/v1/health` (used by Docker's health check) says only that a check failed, never why, because anyone can read it; the reasons are on this page and in the server log.

**The update check** asks GitHub for the latest release of FixFlow, only when an administrator opens this page, at most twice a day, and sends nothing about your install except the version in the request's user agent. Turn it off with the checkbox on the page, or for the whole server with `FIXFLOW_UPDATE_CHECK=false` in the environment (which the checkbox cannot override), for example on a server with no internet access. A failed lookup is shown as *unknown*, never as "up to date". Until a release is published on GitHub it says so.

## The audit log

**Settings, Audit Log** (administrators) lists who did what, newest first. Each line has the time, the person (or *System* when a job or a public request did it), what happened, the record, which fields changed, and the address it came from. Filter by person (name or email), kind of record, what happened (created, changed, deleted, restored, revoked, deactivated, reactivated, signed in), part of the record's name, and dates; **Export CSV** downloads the same list with the same filters (at most 50,000 lines, and it says if it was cut; text a spreadsheet would run as a formula is made plain text). The list is also at `GET /api/v1/activity_logs` (managers and administrators; filters `person`, `resource_type`, `verb`, `q`, `from`, `to`; `.csv` for the file).

**What is written down, whoever does it and however (the screens, an import, a job):**

- Created, changed and deleted: **assets** (a removed asset is *deleted*, and can be *restored*), **locations**, **work orders** (and, as before, each step they go through), **PM schedules**, **IoT rules**, **API keys** (a switched-off key is *revoked*) and **people** (*deactivated* and *reactivated* have their own lines).
- **Sign-ins** (who, from where, on what device) and the ending of a signed-in device.
- Changes to the **company's settings** (and branding, date and currency settings, email settings), **imports** (one line for the whole file), parts and stock changes, and loading or removing example data.

**What is not written down.** A change records *which fields* changed, never their values (a value can be a wage, a secret or a customer's text), with one exception: a change of someone's role shows the old and the new role. Passwords appear only as "password changed". Nothing is written for the things the system keeps up to date by itself (a schedule's next due date and counters, how often an IoT rule has fired, sign-in counters, a work order moving through its states beyond the one line each step already writes), for IoT readings and alerts (far too many), or for a failed sign-in. Reports and the dashboards' recent activity show the work, not who signed in. A line is written after the change is saved, so a change that is rolled back leaves none; if writing a line ever fails, the change itself is still saved.

**How long it is kept.** For ever by default; see *Data retention* below to set a limit.

## Data retention

**Settings, Data Retention** (administrators) shows what the data really takes up (the database and its biggest tables, and the uploaded files; FixFlow does not know how big your disk is) and sets how long two kinds of data are kept:

- **Sensor readings and their hourly summaries**: 7 days to 10 years (a year by default). The nightly cleanup (`Iot::CleanupReadingsJob`, 02:00 UTC) deletes older ones, in small batches. A reading that raised an IoT alert is **always kept**, as the alert's evidence (and the database would refuse to delete it). This is the same setting as *Keep sensor readings for* on the Organization page. Before this change the limit came from `IOT_RETENTION_DAYS` (90 days) and the company's own setting was ignored; now the company's setting wins, `IOT_RETENTION_DAYS` is used only for a company that never chose one, and without either it is a year, so an install that relied on the old 90 days now keeps more.
- **Audit log**: for ever by default, or 1 to 7 years (`AuditLogCleanupJob`, 02:30 UTC).

Everything else (work orders, assets, IoT alerts, comments, uploaded files) is kept until someone deletes it. **Before saving a shorter limit the page asks the server what it would delete** and says so (for example "120 readings past this limit will be deleted for good in the next nightly cleanup"); nothing is deleted until you save, and then only at the next nightly run. Each cleanup that deletes something writes a line by the system to the audit log (what and how many). `bin/rails fixflow:cleanup_readings` runs both cleanups by hand.

**Backups** are described below.

## Backups and restoring

**What is backed up.** A production server copies the **database** every night at 03:00 UTC (`DatabaseBackupJob`, run by the background worker) into the backup bucket (`MINIO_BACKUP_BUCKET`, `fixflow-backups` by default), as a gzipped SQL file named `fixflow_YYYYMMDD_HHMMSS.sql.gz`, and deletes backups of that name older than 30 days. In the same run it copies the **photos and documents people uploaded** (the `MINIO_BUCKET` file storage) to `files/` in the backup bucket. Only files the backup does not have yet are copied, so a quiet night copies nothing. The database dump is stored last, so a backup that is listed has its files. Files that are deleted from FixFlow stay in the copy (an older database backup may still point at them); delete them from the backup bucket by hand if the space matters. A development server makes no backups. `rails fixflow:backup` makes one now (before an upgrade, say).

**Where the backups are kept.** By default in the same file storage as the data: the same server and the same disk, so they do **not** survive losing that server or disk. For a backup that does, point them at another S3-compatible storage (Amazon S3, Backblaze B2, Wasabi, a MinIO or SeaweedFS on another machine) in `.env`:

```bash
BACKUP_S3_ENDPOINT=https://s3.eu-central-003.backblazeb2.com   # leave out for Amazon S3
BACKUP_S3_ACCESS_KEY=...
BACKUP_S3_SECRET_KEY=...
BACKUP_S3_BUCKET=fixflow-backups      # must exist already; give the key access to this one bucket only
BACKUP_S3_REGION=us-east-1
BACKUP_S3_PATH_STYLE=true             # false for Amazon S3
```

Once either the key or the endpoint is set, the backups use only these settings (never the `MINIO_*` login), and both keys are required. The server checks them when it starts. The Data Retention page shows a warning while the backups are on the same storage as the data. Sensible places to keep copies: another provider or region, with versioning or a retention lock switched on at the provider so that a deleted or encrypted backup can be recovered.

**When one fails.** The backup is tried again 15 minutes later, and once more after that (3 tries). Only if the last try fails, a `backup.failed` line is written to the audit log and **every active administrator is emailed** (it is not one of the choices on the notification screen, like an invitation; it needs email to be set up, and the background worker to be running to send it). One bad night is one email, not three. If nothing runs at all (the worker is stopped), nothing can tell you, which is why the page below warns when the newest backup is more than 26 hours old.

**The Data Retention page** (Settings, Data Retention, administrators only) lists the backups in the storage with their size, lets you download one (the database only; the files are in the bucket's `files/` folder), and shows a warning when a backup is overdue or the storage does not answer. A backup holds everything in the database, **password hashes included**, so every download is written to the audit log. The page downloads through the browser's memory: for a very large database fetch the file from the storage bucket directly.

**Restoring** is done on the server with a command, never from the web page, with the web and worker processes stopped. On the Docker install, `make restore` does all of it (stops them, restores in a one-off container, starts them again):

```bash
make restore FROM=latest CONFIRM=yes                       # the newest nightly backup
make restore FROM=fixflow_20261018_030000.sql.gz CONFIRM=yes   # a named one from the file storage
make restore FROM=backup_20261018.sql.gz CONFIRM=yes       # a file in this folder (from `make backup`, or downloaded)
```

That replaces the whole database (it passes `REPLACE=yes`: the container's start-up has already created empty tables, so the database is never empty there). Without `make`, or outside Docker, run the command yourself:

```bash
rails fixflow:backups                              # list the backups in the storage, newest first
rails "fixflow:restore[latest]"                    # restore the newest one
rails "fixflow:restore[fixflow_20261018_030000.sql.gz]"   # or one from the list
rails "fixflow:restore[/path/to/backup.sql.gz]"    # or a file you downloaded (a plain .sql from `make backup` also works)
```

- It restores into an **empty database** and refuses (changing nothing) if the database already has tables. Add `REPLACE=yes` to delete everything in the database first; the deletion and the restore are one transaction, so a restore that fails half way leaves the old data as it was.
- The file is checked to be a complete dump before the database is touched, and the restore stops at the first error and rolls back.
- It copes with a dump made under another database user, and with a dump made by a newer `pg_dump` than the database server (the app image's `pg_dump` is version 18 and the compose file's database is PostgreSQL 16).
- Afterwards it says whether the backup is from an older FixFlow (run `rails db:migrate`) or a **newer** one (upgrade FixFlow first).
- Afterwards it copies the uploaded files back from `files/` in the backup bucket, but only the ones the file storage does not already have, so it is safe on a server that kept its disk. It creates the uploads bucket if the new server has none. `FILES=no` skips this; `rails fixflow:restore_files` does only this (for example when the backup storage was unreachable). `make restore` does it too.
- If the backup storage cannot be reached, the database is already restored and the command says so and exits with an error; run `rails fixflow:restore_files` again once it answers.

`make backup` writes a gzipped dump of the production database to `backup_YYYYMMDD.sql.gz` in the current folder (it is ignored by git); restore it with `make restore` above.

**Not covered:** the sensor broker's data (`mqtt_data`; sensor readings are in the database) and Redis (queued jobs only). The `.env` file is not in a backup either: keep a copy of it somewhere safe. A server restored with a different `SECRET_KEY_BASE` cannot read the saved email password (enter it again under Settings, Email).

## Upgrading and rolling back

FixFlow is released as versions (`v0.2.0`, `v1.0.0`, ...; the [releases page](https://github.com/GetFixFlow/fixflow/releases) lists them, and Settings, System Health says when a newer one exists). Each release has notes with the list of changes and, at the top, a **Before you upgrade** list when there is something you must do. Read it first. Before 1.0, a new minor version (`0.2.0` to `0.3.0`) may change things that were working; the notes say what.

**To upgrade a Docker install** (the one from "Install on a server"), in the folder you run it from:

```bash
make upgrade TO=v0.2.0
```

It does four things, and stops at the first that fails, before anything is changed:

1. Checks that the server is running and that you have not edited files git tracks (`git status` shows which; your `.env` is not one of them).
2. Dumps the database to `backup_before_upgrade_<time>.sql.gz` in that folder and checks the file is whole.
3. Notes what is running now in `.fixflow_upgrade`, so the way back is known.
4. Switches the folder to the new version, rebuilds and starts it. **The database migrations run when the server starts**, so there is no separate step. It takes a few minutes, and the web app is unavailable while it restarts.

Then open Settings, System Health: everything should be working, and the version is the new one. If the new version needs a setting that your `.env` lacks, it stops at start with a message naming it (the same check as at install); add it to `.env` and run `make prod`.

**To go back**, if the new version does not start or something important does not work:

```bash
make rollback CONFIRM=yes
```

This switches the folder back to the version that was running and **replaces the database with `backup_before_upgrade_<time>.sql.gz`**. Anything entered since the upgrade is lost, so decide quickly, and keep the backup file as long as you may need it. Uploaded photos and documents are not touched by an upgrade or by the rollback. The database is restored as a whole, because a migration cannot be undone one step at a time: some drop or reshape columns.

Things to know:

- The folder is left on a fixed version (git calls it a detached HEAD) after an upgrade or rollback. `git switch main` returns to the newest code on the main branch; that is not a released version, so servers that matter should stay on tags.
- `make upgrade` and `make rollback` exist in the folder from the version that has them. A server that is on an older version has to do it by hand once: `make backup`, then `git fetch --tags && git checkout v0.2.0 && make prod`; to go back, `git checkout <the old version> && make restore FROM=backup_<date>.sql.gz CONFIRM=yes`.
- The nightly backups (see "Backups and restoring") are not replaced by the backup an upgrade takes; it is one more copy, from the moment before.
- `bin/check_upgrade` is the proof that this works: CI runs it on every change. It starts the version the change is merged onto, puts data in it (a company, a user, a place, an uploaded file), upgrades it with `bin/upgrade`, checks the data and the migrations, rolls back with `bin/rollback`, and checks the old version is back. What it does not try: an upgrade across many versions at once, a large database (a slow migration), or a server behind a proxy that you configured differently.

## Reporting a problem without an account (QR labels)

Every asset's QR label now links to a public form, `/request?asset=<code>`, where anyone (a visitor, a nurse, a tenant) can report a problem **without an account**. The form says which equipment the label is on, asks for a name (an email is optional), and what is wrong. It becomes an ordinary work order (priority and due date from **Settings → Company**), the managers are emailed, and the person gets a link, `/request/<token>`, to follow it: received, assigned, in progress, completed (or closed without work). If the link is lost the request cannot be looked up again, so the form says to keep it, and remembers the last five on that device.

Print labels from **Assets → Print labels** (or an asset's page). **Labels printed before this change point at the asset page and still need a sign-in**: reprint them. A label that is not recognised (an asset since removed) still lets the person report the problem by typing the place and equipment.

**What strangers can and cannot do.** The two public calls (`POST /api/v1/work_requests`, `GET /api/v1/work_requests/:token`) plus the label lookup (`GET /api/v1/public_assets/:code`) are the only ones that need no sign-in, and they are built for hostile callers:

- The request link holds 128 random bits and the label code 140; neither can be counted up to or guessed, ids and work order numbers never appear on a public page, and a wrong link gets the same "not found" as one that never existed. The status shows only the title, the person's own words, a stage and two dates: never names, emails, the assignee, comments, costs, the team's cancel or reject reasons, or any other work order.
- The caller chooses nothing but words: priority, status, company, assignee and token cannot be set. Each field has a size limit (description 2000 characters, name 100, email 254, place and equipment 200), control characters are removed, and anything over 16 KB is refused. Text is always shown as plain text, and emails are plain text.
- Limits per address: **5 reports per 10 minutes, 20 per day, and 60 per hour from everyone together** (so a flood spread over many addresses still cannot bury the managers' inboxes; the cost is that a flood can also stop real reports for a while), and 60 link or label lookups per 5 minutes. Over the limit the answer is `429`. A hidden form field catches simple scripts: they are told it worked and nothing is created.
- The pages are sent with `Cache-Control: no-store`, `X-Robots-Tag: noindex` and `Referrer-Policy: no-referrer`, so the link does not end up in caches, search results or other sites' logs. Server logs filter the `token` and `email` parameters, but a request's path (with the token) is logged by the web server in front: treat access logs as you would the work orders themselves.

Behind a proxy the limits count the address the proxy reports (`X-Forwarded-For`); make sure your proxy sets it, or every visitor shares one allowance.

**Turning the form off.** An administrator can switch the public form off under **Settings, Advanced Settings** (a company setting, on by default). While it is off, `POST /api/v1/work_requests` and the label lookup answer `403` with the code `PUBLIC_REQUESTS_OFF`, the form shows "This request form is turned off. Please contact your maintenance team directly." before anyone types a request (it asks `GET /api/v1/public_request_form`, which says only whether the form is open), nothing is created and no manager is notified, and a script that fills the hidden field is refused the same way. Links to requests already made keep showing their progress. Turning it back on takes effect at once.

## Exporting reports

The **Export** menu on a report page downloads the report as a file made by the server, with the same dates and filters as the screen (managers and administrators only, like the reports themselves):

| Report | CSV holds | PDF |
| --- | --- | --- |
| Work Orders | every work order in the period matching the filters: number, title, priority, status, asset, assignee, due, started and completed times, labor, parts and total cost | the summary (figures, by priority, trend) |
| Asset Health | one row per place: total, operational, degraded, down, health score | yes |
| PM Compliance | one row per month: scheduled, completed, skipped, compliance rate | yes |
| Cost Analysis | the cost of **every** asset that cost something (the screen shows the top 20): labor, parts, total, work orders | no |
| Technician Performance | each person's figures | no |
| IoT Analytics | every alert in the period matching the filters: when, asset, place, rule, severity, status, the reading and limit, who handled it, work order | no |

Files open in Excel as they are (UTF-8, so accents and non-Latin names are kept; times are `YYYY-MM-DD HH:MM` in the company's time zone, money is a plain number). A CSV holds at most **50,000 work orders**; if there are more, the file is cut and the page says so.

**Text that a spreadsheet would run as a formula is saved as text.** Titles and names can come from anyone (including people reporting a problem without an account), and Excel runs a cell that starts with `=`, `+`, `-` or `@`. Such cells are written with a leading `'`, so a title like `=HYPERLINK(...)` shows as text instead of running.

The files follow the same Filters as the screen: Technician Performance the period, assets, places, people, priorities and source; Asset Health the assets and places (it describes the fleet as it is now, so the period does not apply). For other tools, the same files are at `GET /api/v1/reports/work_orders/summary.csv`, `assets/health.pdf` and so on (the screen's address with `.csv` or `.pdf` on the end, signed in as a manager); a report that has no PDF answers `406`.

## Localization

**Settings → Localization** (administrators) sets how dates, times, numbers and money are shown to everyone: the **date format** (for example 05/10/2026, 05 Oct 2026, 2026-10-05), **12- or 24-hour time**, the **currency** (USD, EUR, GBP, JPY, CAD, AUD, CHF, INR, LKR, SGD), the **number style** (1,234.56 or 1.234,56 or with spaces) and the **first day of the week** in calendars and weekly reports. The page previews the result as you choose. The **time zone** is the same one as in Company settings and is used for schedules, such as when preventive maintenance falls due; dates and times on screen are shown in each person's own device time.

Not covered yet: **language**. There are no translations, so the page does not offer a language (it is on the roadmap as "Language support"). The resolution heat map in the reports still starts its weeks on Monday whatever is chosen, a few small date labels (such as month names in some charts) keep their own style, and labor cost is still worked out at a fixed 40 per hour whatever the currency.

## Branding

**Settings → Branding** (administrators) puts the company's own look on the install: a **logo** (shown in the sidebar and on the sign-in page), a **favicon**, one **primary colour** that restyles the whole app (buttons, links, highlights), and the **headline and subtitle** on the sign-in page. The colour is shown on the page as you pick it, and it must be dark enough for white text to be readable on it (the page tells you if it is not). Logos are PNG, JPEG or WebP up to 2 MB; favicons PNG or ICO up to 512 KB. SVG is not accepted, as it can carry scripts. The branding is public by design, because the sign-in page needs it before anyone has signed in.

## Working offline

A technician who loses signal can keep going. With no connection, **Start work, Put on hold, Waiting for parts, Resume and Complete**, **comments** and **photos and documents**, are saved on the phone, shown straight away with a *Waiting to sync* badge, and sent in order when the connection returns. The status at the top of the screen shows what is waiting. If the server refuses a change (for example, the work order was reassigned meanwhile), it is listed there with the reason instead of disappearing. Changes belong to the person who made them, so a shared phone keeps each person's separate.

Photos are shrunk to at most 1600 pixels on a side before they are kept or sent, so they are quick to upload and small to store on the phone; a photo that cannot be sent stays on the phone until it can, and anything over 10 MB or not a photo, PDF or Word document is refused with the reason.

Things that need the server's decision (assigning, verifying, rejecting, cancelling, editing a work order) still need a connection.

To reopen a page you already visited while offline, the app must be served over **HTTPS** (browsers only allow the offline cache on secure addresses; `localhost` counts). On a plain `http://` address the offline cache is not available: changes made while the page stays open are still saved and sent, but reloading the page offline will not work.

## Email

FixFlow sends email for invitations, password resets, work order assignments and low-stock alerts. Without a mail server it still works: invitations and password resets give an administrator a link to copy and send themselves.

**Set it up in the app:** **Settings → Email** (administrators). Enter the mail server, then **Send me a test email**: it sends a message to you through what is in the form, without saving it, and if it fails it tells you why in plain words (wrong password, host not found, nothing listening on that port, wrong encryption). When the test arrives, **Save**. Saved settings apply to the next email without a restart and take priority over the server's environment. The password is stored encrypted (with a key derived from `SECRET_KEY_BASE`, so if you change that secret, enter the password again) and is never shown again.

| Mail service | Server | Port | Encryption | Notes |
| --- | --- | --- | --- | --- |
| Microsoft 365 | `smtp.office365.com` | 587 | STARTTLS | Username and sender are the mailbox. SMTP AUTH must be enabled for it in the Microsoft 365 admin centre. |
| Gmail / Google Workspace | `smtp.gmail.com` | 587 | STARTTLS | Use an [app password](https://myaccount.google.com/apppasswords) (needs 2-Step Verification), not the account password. The sender must be that account. |
| A mail server on your network | its address | 25 (or 587) | None (or STARTTLS) | Many internal servers need no username or password. If it asks for one, enter it. |

**Or set it in the server's environment** (`.env`): `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`. These are used when nothing is saved in the app. Email counts as set up in production once there is a saved mail server or both `SMTP_HOST` and `SMTP_PASSWORD`.

Emails are sent in the background, and a failure there is only logged. If people say they are not getting email, use **Send me a test email** first: it shows the actual error.

### Choosing which emails you get

Everyone chooses their own emails in **Settings → Notifications**: one switch for all email, and one tick per kind of email. The kinds are the ones the app sends today: a work order assigned to you, one you requested being finished, one needing verification (managers), a problem reported from a QR label (managers), a scheduled work order created for you, maintenance due this week, maintenance overdue (managers) and a part running low or out (managers). Until someone changes something they get everything, as before. **Invitations and password reset links are always sent**, and so is the "your request is done" email to someone who reported a problem through the public form (they have no account to choose in).

Deactivated people are never emailed. Before this, several emails to managers (new problem reports, work awaiting verification, overdue and due maintenance) also went to deactivated managers.

Not offered yet, because nothing sends them: push notifications, in-app notifications, daily and weekly digests, and emails about overdue work orders and sensor alerts. The **alert sound** switch applies to the browser it is set in (it is kept in that browser, not on the server).

## Architecture

```
IoT Devices ──MQTT/REST──► FixFlow API (Rails 8)
                                  |
                    +─────────────+─────────────+
                    |             |             |
              PostgreSQL       Redis          S3 storage
             (core data)    (Sidekiq)    (file storage)
```

**Stack:**
- **API**: Ruby on Rails 8, API mode
- **Auth**: Devise + devise-jwt (Bearer JWT)
- **Jobs**: Sidekiq + Redis
- **Storage**: ActiveStorage → an S3-compatible server (SeaweedFS in the Docker install)
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

These run in CI on every pull request (the `test` job: a real PostgreSQL 16 and Redis 7, the schema loaded fresh, `bundle exec rspec`), so a change that breaks one cannot be merged unnoticed. They need PostgreSQL and Redis running (Redis for `rake fixflow:stats`, which reports on it), but no mail server or API key.

### Frontend (Vitest)

```bash
cd apps/web
npm run test          # run all tests
npm run test:ui       # Vitest UI
npm run test:coverage # coverage report
```

### Keeping the web app and the API in step

```bash
bin/rails web:check_routes
```

lists every request the web app makes (read from the TypeScript source in `apps/web/src`, through `apiClient`, and the report downloads made with `exportReport('report', 'csv')`) and checks that Rails has a route for each, with the same verb, and that no API route leads to a controller action that does not exist. It needs Node and the web app's dependencies (`npm ci` in `apps/web`), not a database, and it runs in CI. It prints what it finds and exits with an error if the web app and the routes disagree.

If it reports **NO ROUTE**, either the endpoint is missing (build it) or the request should not be there (remove it). **PATH NOT IN THE SOURCE** means a request builds its address from a variable, so it cannot be checked: write the address out. The few requests that cannot be matched on purpose are listed, each with its reason, in `config/web_routes_allowlist.yml`; an entry that is no longer needed is reported too, so the list cannot go stale. The same check is part of `bundle exec rspec spec/lib`.

The check compares addresses and verbs. What the report endpoints send back is checked separately, from both ends: `spec/contracts/report_shapes_spec.rb` builds fixed data, calls each report and compares the response, field by field and kind of value, with a JSON file in `apps/web/src/test/fixtures/reports`; the web tests load the same files into the types the screens read (`apps/web/src/types/reports.ts`) and render the real pages with them. A field renamed on either side fails a test. After changing a report on purpose, regenerate the files with

```bash
UPDATE_REPORT_FIXTURES=1 bundle exec rspec spec/contracts/report_shapes_spec.rb
```

and commit them with the web change. Every report screen (Work Orders, Asset Health, Technician Performance, PM Compliance, IoT Analytics, Cost Analysis) and the dashboard (for each role) is covered. Anything else the web app reads from the server is not, yet.

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

## Contributing

Bug reports, ideas, documentation fixes and code are welcome: see [CONTRIBUTING.md](CONTRIBUTING.md) for how to set up, what a pull request needs (a test that fails without the change, an update here and in the CHANGELOG, and an honest list of what was not tried), and the checks CI runs. Everyone taking part follows the [Code of Conduct](CODE_OF_CONDUCT.md). **Security problems are reported privately, not in an issue:** see [SECURITY.md](SECURITY.md). Issues labelled [`good first issue`](https://github.com/GetFixFlow/fixflow/labels/good%20first%20issue) are a good place to start.

---

## License

AGPLv3 — see [LICENSE](LICENSE).
