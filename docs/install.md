# Install on a server

!!! tip "A small server?"
    For a team that fits on one server with **2 GB of memory**, with no file-storage server and no sensor broker, use the [lite install](lite.md) instead. Everything below applies to it, apart from the services and the two `.env` lines that page lists.

Install FixFlow with Docker on a Linux server, then set it up.

You need a Linux (or macOS) machine with Docker and Docker Compose v2, about 2 GB of memory, and a few GB of disk. Nothing else is installed on it: the database, Redis, the file storage and the sensor broker all run in containers.

```bash
git clone https://github.com/GetFixFlow/fixflow.git
cd fixflow
cp .env.example .env
# Fill in the "Required" block of .env. Every line has the command beside it that makes its value (openssl rand -hex 24 ...).
docker compose -f docker-compose.prod.yml up -d --build      # or: make prod
```

The first start builds the two images on the server (about 5 to 10 minutes) and pulls the rest. Then open the address you put in `APP_URL`: a new install shows **Set up FixFlow** (see [First-run setup](#first-run-setup) below). `docker compose -f docker-compose.prod.yml ps` shows seven services, all `healthy`: `web`, `api`, `sidekiq`, `db`, `redis`, `mqtt` and `s3`.

- **One front door.** `web` serves the web app and passes `/api` and `/cable` (live updates) on to the API. It listens on `HTTP_PORT` (80 unless you set another; put the port in `APP_URL` if it is not 80). The sensor broker is on port 1883. **Nothing else is published**: the database, Redis, the file storage and the API can only be reached from inside.
- **HTTPS is optional and built in.** The front door itself speaks plain HTTP, so sign-in tokens cross your network unencrypted until you turn on [HTTPS](https.md) or put your own TLS proxy in front.
- **File storage** is [SeaweedFS](https://github.com/seaweedfs/seaweedfs) speaking the S3 protocol (the `MINIO_*` settings keep their old names and work for any S3-compatible server; MinIO's own image can no longer be pulled).
- **Settings.** Everything in `.env` reaches the API and the worker, so any setting in the [settings table](configuration.md) can be added there. If a required one is missing, `docker compose` says which.
- **Data lives in four volumes** (`postgres_data`, `redis_data`, `s3_data`, `mqtt_data`); `docker compose ... down` keeps them, `down -v` deletes them. Back up as described in [Backups and restoring](backups.md).
- **Commands.** Commands in these pages that start with `docker compose exec api rails ...` are written for the development stack; on a production install they are `docker compose -f docker-compose.prod.yml exec api bin/rails ...`. `make prod`, `make prod-status`, `make prod-logs`, `make prod-stop`, `make backup` and `make restore` wrap the common ones.

## First-run setup

Each FixFlow install serves one company. Open the web app and, on a new install, it shows **Set up FixFlow**: enter your company name and the first administrator's details. Once that is done, public sign-up is closed (`POST /api/v1/auth/sign_up` returns `403`) and the login page no longer offers it.

## Demo company (trial installs)

For a trial install with nothing in it, to try FixFlow with a whole sample company (assets, work orders, PM schedules, IoT rules and sensor readings):

```bash
docker compose exec api rails fixflow:demo_data     # or: make demo-data
```

It works in any environment, but only on an install with no company of its own: it refuses once a real company exists. It creates accounts such as `admin@demo.com` with the password `password123`, so in production it asks for `CONFIRM=yes`. `rails db:seed` loads the same data in development only. Setting `SEED_DB=true` loads it when the API container starts.

Loading demo data counts as setting the install up, so the first-run screen above is skipped. Skip this step if you want to start with your own company.
