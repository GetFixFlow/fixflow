# Backups and restoring

What is backed up, where it goes, how to restore, and how long data is kept.

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

## Data retention

**Settings, Data Retention** (administrators) shows what the data really takes up (the database and its biggest tables, and the uploaded files; FixFlow does not know how big your disk is) and sets how long two kinds of data are kept:

- **Sensor readings and their hourly summaries**: 7 days to 10 years (a year by default). The nightly cleanup (`Iot::CleanupReadingsJob`, 02:00 UTC) deletes older ones, in small batches. A reading that raised an IoT alert is **always kept**, as the alert's evidence (and the database would refuse to delete it). This is the same setting as *Keep sensor readings for* on the Organization page. The company's setting wins; `IOT_RETENTION_DAYS` is used only for a company that never chose one, and without either it is a year.
- **Audit log**: for ever by default, or 1 to 7 years (`AuditLogCleanupJob`, 02:30 UTC).

Everything else (work orders, assets, IoT alerts, comments, uploaded files) is kept until someone deletes it. **Before saving a shorter limit the page asks the server what it would delete** and says so (for example "120 readings past this limit will be deleted for good in the next nightly cleanup"); nothing is deleted until you save, and then only at the next nightly run. Each cleanup that deletes something writes a line by the system to the audit log (what and how many). `bin/rails fixflow:cleanup_readings` runs both cleanups by hand.

