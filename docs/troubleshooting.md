# Troubleshooting

Start with **Settings, System Health** (administrators): it checks the database, Redis, the background worker, email, the sensor broker and file storage live, and says which one is down and what to do. See [Watching the install](monitoring.md). When the web app itself does not open, use the commands below.

On a Docker install every command is run in the folder that holds `docker-compose.prod.yml`. `make prod-status` is the first of these and `make prod-logs` follows every service's log:

```bash
docker compose -f docker-compose.prod.yml ps                       # every service should say "healthy"
docker compose -f docker-compose.prod.yml logs --tail 100 api      # the last lines of one service (api, sidekiq, web, db, redis, mqtt, s3, https)
docker compose -f docker-compose.prod.yml exec api bin/rails fixflow:check_config    # check the settings and whether the services answer
```

## The install

**`docker compose` stops and names a variable that is "required".** A setting in the *Required* block of `.env` is empty. Fill it in; each line has the command beside it that makes its value. See [Install on a server](install.md).

**The first start takes ten minutes.** It builds the two images on the server (5 to 10 minutes) and pulls the rest. `ps` shows the services becoming `healthy` one by one.

**A service never becomes healthy, or keeps restarting.** Read its log (`logs --tail 100 <service>`). The `api` and `sidekiq` services check the settings before starting and print the reason in plain words, for example a secret that is missing, too short or still the example value, an address that is malformed, or a database or Redis that does not answer: see [the start-up check](configuration.md#the-server-checks-its-settings-when-it-starts). Run `fixflow:check_config` as above to see the same list. `SKIP_CONFIG_CHECK=true` skips the check in an emergency; it does not fix the cause.

**The web app does not open.** Check `APP_URL` and `HTTP_PORT` in `.env`: the web app listens on `HTTP_PORT` (80 unless you set another), and `APP_URL` must contain the same port when it is not 80. If something else on the server already uses port 80, set another `HTTP_PORT`. With [HTTPS](https.md) switched on, ports 80 and 443 belong to the `https` service and the plain door must be moved (`HTTP_PORT`, `HTTP_BIND`); the server says so when the settings clash.

**Links in emails (invitations, password resets) point at the wrong address.** `APP_URL` is empty or wrong. Set it to the address people open FixFlow at.

## Signing in

**"Too many wrong passwords. Try again in 30 minutes, or ask an administrator to unlock your account."** Ten wrong passwords lock an account for 30 minutes; it opens by itself, or an administrator opens it at once (**Settings, Users**, the person's menu, **Unlock account**). See [Sign-in and security](security.md#passwords-and-locked-accounts).

**Forgot the password.** **Forgot your password?** on the sign-in screen emails a link. When the server cannot send email, an administrator makes a link under **Settings, Users, Reset Password**. See [People and roles](users.md#forgotten-passwords).

**Lost the phone with the authenticator app.** Use a recovery code at the code prompt. With none left, an administrator uses **Settings, Users, Reset two-factor** for the person. If the person is the only administrator, run this on the server:

```bash
docker compose -f docker-compose.prod.yml exec api bin/rails "fixflow:reset_two_factor[their@email]"
```

**Everyone's two-factor sign-in stopped working, and the saved email password is gone.** `SECRET_KEY_BASE` was changed. Both are stored encrypted with a key made from it. Put the old value back, or reset two-factor for each person and enter the email password again under **Settings, Email**.

**"Too many requests" (429).** Sign-in is limited to 10 attempts a minute per address, and the whole API to 300 requests per 5 minutes ([limits](api.md#limits)). Behind a proxy, every person shares one address unless the proxy sends `X-Forwarded-For`.

**A password is refused.** A new password must be 10 to 128 characters and not easy to guess; the message says why. A few words in a row work well.

## Email

**Nobody gets emails.** Open **Settings, Email**, fill in the mail server and press **Send me a test email**: it shows the real error in plain words (wrong password, host not found, nothing listening on that port, wrong encryption). Emails are sent by the background worker, so also check that **Background jobs** on System Health says *Working*. A person may also have switched emails off under **Settings, Notifications**. See [Configuration](configuration.md#email).

**Invitations cannot be emailed.** They are not lost: the invite dialog gives a link to copy and send yourself.

## Live updates and background work

**New IoT alerts do not appear on their own, or the monitor never says *Live*.** The reverse proxy in front of FixFlow must pass WebSocket upgrades on `/cable`. The Docker install's own front door does; a proxy you added does not unless you configure it. See [Sensors and IoT](iot.md).

**System Health says *Background jobs: Down*.** No worker (Sidekiq) is running. Without one, emails, scheduled maintenance work orders, IoT alerts and the nightly backups and cleanups silently stop. Check `ps` and `logs --tail 100 sidekiq`, then `docker compose -f docker-compose.prod.yml up -d sidekiq`.

## Sensors

**Readings do not arrive.** Over HTTP: the `X-API-Key` header must hold a key made under **Settings, API Keys** (shown only once), and `asset_id` must be the asset's id or its asset tag; an unknown asset answers "Asset not found". Over MQTT: the device needs the broker's username and password (`MQTT_USERNAME`, `MQTT_PASSWORD`), and the topic needs the company token (the company name in lowercase with dashes, shown as `slug` by `GET /api/v1/organization_settings`). System Health shows whether the broker answers, whether FixFlow is subscribed, and when the last message arrived. See [Sensors and IoT](iot.md).

**Every reading appears twice.** Two processes listen to the sensor broker. Only the background worker should: leave `MQTT_SUBSCRIBER` unset, or set it to `true` on one process only.

## Phones

**The camera will not open to scan a QR code, or a page does not reopen offline.** Browsers allow both only on an `https://` address (or `localhost`). Turn on [HTTPS](https.md). With the `internal` mode, each phone must also trust FixFlow's own certificate authority.

## HTTPS

**No certificate is issued (`automatic`).** `docker compose -f docker-compose.prod.yml logs https` says why. The usual causes are that the name does not point at this server yet, or a firewall in front of port 80 or 443 (Let's Encrypt must reach port 80 from the internet). Certificates are kept in the `caddy_data` volume: do not delete it often, because Let's Encrypt limits how many it issues for a name. See [HTTPS](https.md).

**The server refuses to start after turning on HTTPS.** The settings clash: `APP_URL` must be `https://` plus `HTTPS_DOMAIN`, and `HTTP_PORT` must no longer be 80. The message names the setting.

## Backups, upgrades and restoring

**The Data Retention page warns that the newest backup is overdue.** The nightly backup (03:00 UTC) did not run or did not finish: usually the worker is down, or the backup storage does not answer. A failed backup is tried three times and then every administrator is emailed. See [Backups and restoring](backups.md).

**A restore refuses to run.** It restores into an empty database and refuses one that already has tables. `make restore` passes `REPLACE=yes` for you; outside it, add `REPLACE=yes` to replace everything.

**An upgrade stopped.** `make upgrade` stops at the first problem, before changing anything: the server must be running and the files git tracks must be unedited. If the new version starts and then says a setting is missing, add it to `.env` and run `make prod`. To go back, `make rollback CONFIRM=yes` restores the database from the backup the upgrade took, which loses what was entered since. See [Upgrading and rolling back](upgrading.md).

## The lite install

**Photos cannot be saved, the backup fails, or the database stops.** On the [lite install](lite.md) the database, Redis, the uploaded files and the backups all share the server's disk, and a full disk stops all of them. `df -h` shows how full it is and `docker system df` how much Docker holds. Database backups older than 30 days are deleted by the nightly job; the copy of the uploaded files in the `backups` volume is never deleted (an older backup may still need a file), so it only grows.

**System Health says the sensor broker is not set up.** That is right: the lite install has none. Sensors send readings over HTTP (see [Sensors and IoT](iot.md)).

## Still stuck

Collect the output of `ps`, the last 100 lines of the failing service's log and your FixFlow version (System Health, or the `VERSION` file), remove anything secret, and [open an issue](https://github.com/GetFixFlow/fixflow/issues). Do not post `.env`.
