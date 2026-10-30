# Install on a server

!!! tip "A small server?"
    For a team that fits on one server with **2 GB of memory**, with no file-storage server and no sensor broker, use the [lite install](lite.md) instead. Everything below applies to it, apart from the services and the two `.env` lines that page lists.

Install FixFlow with Docker on a Linux server, then set it up.

## One-command install

On a fresh **Ubuntu 22.04+ or Debian 12+** server, one script does everything below: it installs Docker, downloads FixFlow, writes `.env` with random secrets and starts it.

```bash
curl -fsSLO https://raw.githubusercontent.com/GetFixFlow/fixflow/main/deploy/install.sh
less install.sh                                   # read it first: it runs as root
sudo sh install.sh --domain fixflow.example.com --email you@example.com
```

| Option | What it does |
| --- | --- |
| `--domain NAME` | The name people open FixFlow at. Turns on [HTTPS](https.md) with a free Let's Encrypt certificate: the name must already point at this server, and ports 80 and 443 must reach it. |
| `--email ADDRESS` | With `--domain`: where Let's Encrypt writes before a certificate runs out. |
| `--https-mode MODE` | With `--domain`: `automatic` (the default), `own-certificate` (your company's, put in `certs/` before it starts) or `internal` (FixFlow's own). |
| `--url ADDRESS` | Instead of `--domain`: an address of your own, such as `http://fixflow.company.local` or `http://10.0.0.5:8080`. Plain HTTP (or HTTPS done by a proxy of yours). With neither, it uses `http://<this server's address>`. |
| `--lite` | The [lite install](lite.md): five services, for a small server. |
| `--version TAG` | A release such as `v0.2.0`. Default: the newest release, or the development version (`main`) while there is none. |
| `--dir PATH` | Where to put it. Default `/opt/fixflow`. |
| `--no-start` | Do everything but build and start it. |

It checks the system and that ports 80 and 443 are free before changing anything, never overwrites an existing install or `.env`, and prints what it does. When it finishes it prints the address to open: the first page creates your company and the first administrator. **Then set up [backups](backups.md)** (they are on the same disk until you do) and keep a copy of `/opt/fixflow/.env` somewhere safe.

Step-by-step guides with the surrounding setup (firewall, DNS name, backups): [DigitalOcean](server-digitalocean.md), [AWS](server-aws.md) and [a server inside the company network](server-company-network.md).

## Install by hand

You need a Linux (or macOS) machine with Docker and Docker Compose v2, about 2 GB of memory, and a few GB of disk. Nothing else is installed on it: the database, Redis, the file storage and the sensor broker all run in containers.

```bash
git clone https://github.com/GetFixFlow/fixflow.git
cd fixflow
git checkout v0.2.0     # the newest release (the releases page lists them); see "Published images" below
cp .env.example .env
# Fill in the "Required" block of .env. Every line has the command beside it that makes its value (openssl rand -hex 24 ...).
make prod               # starts it with bin/up and waits until every service is healthy
```

On a release the first start pulls FixFlow's two images and the rest (a few minutes); on anything else it builds the two images on the server first (about 5 to 10 minutes). See [Published images](#published-images). Then open the address you put in `APP_URL`: a new install shows **Set up FixFlow** (see [First-run setup](#first-run-setup) below). `bin/compose ps` shows seven services, all `healthy`: `web`, `api`, `sidekiq`, `db`, `redis`, `mqtt` and `s3`.

- **One front door.** `web` serves the web app and passes `/api` and `/cable` (live updates) on to the API. It listens on `HTTP_PORT` (80 unless you set another; put the port in `APP_URL` if it is not 80). The sensor broker is on port 1883. **Nothing else is published**: the database, Redis, the file storage and the API can only be reached from inside.
- **HTTPS is optional and built in.** The front door itself speaks plain HTTP, so sign-in tokens cross your network unencrypted until you turn on [HTTPS](https.md) or put your own TLS proxy in front.
- **File storage** is [SeaweedFS](https://github.com/seaweedfs/seaweedfs) speaking the S3 protocol (the `MINIO_*` settings keep their old names and work for any S3-compatible server; MinIO's own image can no longer be pulled).
- **Settings.** Everything in `.env` reaches the API and the worker, so any setting in the [settings table](configuration.md) can be added there. If a required one is missing, `docker compose` says which.
- **Data lives in four volumes** (`postgres_data`, `redis_data`, `s3_data`, `mqtt_data`); `docker compose ... down` keeps them, `down -v` deletes them. Back up as described in [Backups and restoring](backups.md).
- **Commands.** Commands in these pages that start with `docker compose exec api rails ...` are written for the development stack; on a production install they are `docker compose -f docker-compose.prod.yml exec api bin/rails ...`. `make prod`, `make prod-status`, `make prod-logs`, `make prod-stop`, `make backup` and `make restore` wrap the common ones.

## Published images

Every release publishes its two images, `fixflow-api` and `fixflow-web`, to GitHub's container registry (`ghcr.io/getfixflow`), for Intel/AMD and ARM servers. Each is tagged with the exact version (`0.2.0`); there is **no `latest` tag**, so an install never changes version by itself. `make prod` (that is `bin/up`) decides what to do:

| The folder is on | `make prod` |
| --- | --- |
| A release (`git checkout v0.2.0`), and its images can be pulled | pulls them: **nothing is built on the server** |
| A release, but they cannot be pulled (no network to the registry, or that release has no images) | says so, and builds them from the source in the folder |
| Anything else (a branch, a commit) | builds them from the source in the folder |

`FIXFLOW_BUILD=yes make prod` always builds here, for example to try a change of your own. `FIXFLOW_PULL=yes make prod` always pulls and stops if it cannot. To use a mirror of the registry (for a server that cannot reach `ghcr.io`), copy the two images there and set `FIXFLOW_IMAGE_REPO=registry.example.com/fixflow` in `.env`; the images must be named `fixflow-api:0.2.0` and `fixflow-web:0.2.0` in it. `make upgrade` does the same as `make prod` after it switches versions ([Upgrading](upgrading.md)).

## First-run setup

Each FixFlow install serves one company. Open the web app and, on a new install, it shows **Set up FixFlow**: enter your company name and the first administrator's details. Once that is done, public sign-up is closed (`POST /api/v1/auth/sign_up` returns `403`) and the login page no longer offers it.

## Demo company (trial installs)

For a trial install with nothing in it, to try FixFlow with a whole sample company (assets, work orders, PM schedules, IoT rules and sensor readings):

```bash
docker compose exec api rails fixflow:demo_data     # or: make demo-data
```

It works in any environment, but only on an install with no company of its own: it refuses once a real company exists. It creates accounts such as `admin@demo.com` with the password `password123`, so in production it asks for `CONFIRM=yes`. `rails db:seed` loads the same data in development only. Setting `SEED_DB=true` loads it when the API container starts.

Loading demo data counts as setting the install up, so the first-run screen above is skipped. Skip this step if you want to start with your own company.
