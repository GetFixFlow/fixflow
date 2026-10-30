# Lite install for small servers

The lite install is FixFlow for a small team on **one small server** (2 GB of memory is enough): the web app, the API, the background worker, PostgreSQL and Redis, and nothing else. Compared with the [full install](install.md) it has **no file-storage server and no sensor broker**:

| | Full install | Lite install |
| --- | --- | --- |
| Services | web, api, sidekiq, db, redis, **s3**, **mqtt** | web, api, sidekiq, db, redis |
| Uploaded photos and documents | in an S3-compatible server (SeaweedFS) | **a folder on the server's disk** (the `uploads` volume) |
| Nightly backups | in a bucket of that server, or another S3 storage | **a folder on the server's disk** (the `backups` volume), or another S3 storage |
| Sensors | HTTP, and MQTT through the broker | **HTTP only** (`POST /api/v1/iot/ingest` with an API key) |
| Memory at rest | not measured | about 400 to 430 MiB for all five containers ([Sizing](#sizing)) |

Everything else is the same: the same images, the same web app, the same settings, [HTTPS](https.md), [upgrading](upgrading.md) and [restoring](backups.md).

## Install

As the [full install](install.md), with two differences in `.env`:

```bash
git clone https://github.com/GetFixFlow/fixflow.git
cd fixflow
cp .env.example .env
```

1. Fill in the **Required** block as usual, but **delete the four `MINIO_*` and `MQTT_*` lines**: nothing here uses them (the start-up check warns if `MINIO_*` is left in).
2. Add the line `COMPOSE_FILE=docker-compose.lite.yml` (it is in `.env.example`, commented out). Docker Compose, `make` and the upgrade scripts all read it, so from here on every command is the one in these pages.

```bash
make prod            # the published images of the release this folder is on, or a build here (see install.md)
make prod-status     # five services, all healthy: web, api, sidekiq, db and redis
```

Then open the address you put in `APP_URL`, exactly as in [First-run setup](install.md#first-run-setup).

## What you give up

- **No MQTT.** Sensors send readings over HTTP: [Sensors and IoT](iot.md). System Health shows the broker as *not set up*, which is correct and not a problem. A sensor that can only speak MQTT needs the full install (or a broker of your own that forwards to the HTTP address).
- **The backups are on the same disk as the data.** By default `make backup` and the nightly job write to the `backups` volume of the same server, so they do **not** survive losing the server or its disk. Set `BACKUP_S3_*` ([Backups and restoring](backups.md)) to send them to another S3 storage (Amazon S3, Backblaze B2, Wasabi...), or copy the `backups` volume off the server yourself. Do this before you rely on the install.
- **Nothing else is shared.** The disk holds the database, Redis, the uploaded files and the backups: keep an eye on its free space. FixFlow does not know how big the disk is.

## Backups and restoring

The same commands, the same names (`fixflow_YYYYMMDD_HHMMSS.sql.gz`), the same checks as the [full install](backups.md): the nightly job at 03:00 UTC, `make backup`, `make restore FROM=latest CONFIRM=yes`, and the list and the download on **Settings, Data Retention**. The differences:

- The backups are files in the `backups` volume (`/app/backups` in the containers), and the copies of the uploaded files are in its `files/` folder, one file per upload.
- **The copy of the uploaded files holds `files/<key>`, the same names as on the full install**, so a backup of one kind of install is meant to restore on the other (covered by specs, not yet tried with a real move between the two).

## Moving to the full install later

This is the plan, not a tested path: install the full one on a bigger server, set `BACKUP_S3_*` on the lite one so a backup is on a storage both can reach, run `rails fixflow:backup` (or wait for the night), and on the new server `make restore FROM=latest CONFIRM=yes` with the same `BACKUP_S3_*` settings. It restores the database and then copies the uploaded files into the new file storage. Keep the old `.env`: a changed `SECRET_KEY_BASE` cannot read the saved email password or anyone's two-factor setting.

## Sizing

!!! note "Measured, at rest"
    With the five containers started, a first company set up, a photo, a sensor reading, a backup and a restore done, the containers used about **400 to 430 MiB** together (two runs: 389 and 428): the API 175, the worker 162, PostgreSQL 35 to 64, Redis 10 to 20 and the web front door 8 (Docker Desktop on a Mac, `docker stats`). That leaves most of 2 GB for the system and for busy days.

    **Not measured:** a busy day (many people at once, a large import, a large report, thousands of sensor readings an hour), a server with the 5,000 assets and 50,000 work orders the roadmap aims at, and the disk: the database, the uploaded files and the backups all share it. If you run it on 2 GB and it struggles, open an issue with the output of `docker stats --no-stream`.

## How it is checked

`bin/check_lite` (run by CI on every change) starts the lite install from a fresh clone and checks that exactly the five services are running, that a photo uploaded over HTTP is kept on the disk and comes back byte for byte, that System Health is fine without a broker, that sensor readings are accepted over HTTP, that a backup of the database and the uploaded file can be listed and **restored after the file and the data are lost**, and that the containers together stay under 800 MiB at rest.
