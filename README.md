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

`.env.example` lists every setting with a note on what it does. These are the ones that matter (the **Needed** column is for a production install):

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
| `IOT_API_KEY` | For IoT over HTTP | The key sensors send to `POST /api/v1/iot/readings`; without one that route refuses everything |
| `SKIP_CONFIG_CHECK` | No | `true` skips the start-up check below (for an emergency) |

Generate secrets:
```bash
bin/rails secret                  # SECRET_KEY_BASE
openssl rand -base64 64           # DEVISE_JWT_SECRET_KEY
openssl rand -hex 32              # IOT_API_KEY
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

## Reporting a problem without an account (QR labels)

Every asset's QR label now links to a public form, `/request?asset=<code>`, where anyone (a visitor, a nurse, a tenant) can report a problem **without an account**. The form says which equipment the label is on, asks for a name (an email is optional), and what is wrong. It becomes an ordinary work order (priority and due date from **Settings → Company**), the managers are emailed, and the person gets a link, `/request/<token>`, to follow it: received, assigned, in progress, completed (or closed without work). If the link is lost the request cannot be looked up again, so the form says to keep it, and remembers the last five on that device.

Print labels from **Assets → Print labels** (or an asset's page). **Labels printed before this change point at the asset page and still need a sign-in**: reprint them. A label that is not recognised (an asset since removed) still lets the person report the problem by typing the place and equipment.

**What strangers can and cannot do.** The two public calls (`POST /api/v1/work_requests`, `GET /api/v1/work_requests/:token`) plus the label lookup (`GET /api/v1/public_assets/:code`) are the only ones that need no sign-in, and they are built for hostile callers:

- The request link holds 128 random bits and the label code 140; neither can be counted up to or guessed, ids and work order numbers never appear on a public page, and a wrong link gets the same "not found" as one that never existed. The status shows only the title, the person's own words, a stage and two dates: never names, emails, the assignee, comments, costs, the team's cancel or reject reasons, or any other work order.
- The caller chooses nothing but words: priority, status, company, assignee and token cannot be set. Each field has a size limit (description 2000 characters, name 100, email 254, place and equipment 200), control characters are removed, and anything over 16 KB is refused. Text is always shown as plain text, and emails are plain text.
- Limits per address: **5 reports per 10 minutes, 20 per day, and 60 per hour from everyone together** (so a flood spread over many addresses still cannot bury the managers' inboxes; the cost is that a flood can also stop real reports for a while), and 60 link or label lookups per 5 minutes. Over the limit the answer is `429`. A hidden form field catches simple scripts: they are told it worked and nothing is created.
- The pages are sent with `Cache-Control: no-store`, `X-Robots-Tag: noindex` and `Referrer-Policy: no-referrer`, so the link does not end up in caches, search results or other sites' logs. Server logs filter the `token` and `email` parameters, but a request's path (with the token) is logged by the web server in front: treat access logs as you would the work orders themselves.

Behind a proxy the limits count the address the proxy reports (`X-Forwarded-For`); make sure your proxy sets it, or every visitor shares one allowance. There is no switch to turn the public form off yet.

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
