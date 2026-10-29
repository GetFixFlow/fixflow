# Upgrading and rolling back

Move to a new version safely, and go back if it goes wrong.

FixFlow is released as versions (`v0.2.0`, `v1.0.0`, ...; the [releases page](https://github.com/GetFixFlow/fixflow/releases) lists them, and Settings, System Health says when a newer one exists). Each release has notes with the list of changes and, at the top, a **Before you upgrade** list when there is something you must do. Read it first. Before 1.0, a new minor version (`0.2.0` to `0.3.0`) may change things that were working; the notes say what.

**To upgrade a Docker install** (the one from [Install on a server](install.md)), in the folder you run it from:

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
- The nightly backups (see [Backups and restoring](backups.md)) are not replaced by the backup an upgrade takes; it is one more copy, from the moment before.
- `bin/check_upgrade` is the proof that this works: CI runs it on every change. It starts the version the change is merged onto, puts data in it (a company, a user, a place, an uploaded file), upgrades it with `bin/upgrade`, checks the data and the migrations, rolls back with `bin/rollback`, and checks the old version is back. What it does not try: an upgrade across many versions at once, a large database (a slow migration), or a server behind a proxy that you configured differently.
