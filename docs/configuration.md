# Configuration

Every setting, what the server checks when it starts, and how to set up email, localization and branding.

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
| `COMPOSE_PROFILES` | No | Docker install: `https` turns on the HTTPS front door (see [HTTPS](https.md)) |
| `HTTPS_DOMAIN` | With `https` | The name people open FixFlow at, like `fixflow.example.com` (the name only). `APP_URL` must be `https://` and that name |
| `HTTPS_MODE` | No | `automatic` (a free Let's Encrypt certificate; the default), `own-certificate` (`certs/fixflow.crt` and `certs/fixflow.key`) or `internal` (FixFlow makes its own) |
| `HTTPS_EMAIL` | No | `automatic` mode: where Let's Encrypt writes before a certificate runs out |
| `HTTP_BIND` | No | Docker install: the address the plain-HTTP door listens on; `127.0.0.1` closes it to the network (use it with HTTPS) |
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

Deactivated people are never emailed.

Not offered yet, because nothing sends them: push notifications, in-app notifications, daily and weekly digests, and emails about overdue work orders and sensor alerts. The **alert sound** switch applies to the browser it is set in (it is kept in that browser, not on the server).

## Localization

**Settings → Localization** (administrators) sets how dates, times, numbers and money are shown to everyone: the **date format** (for example 05/10/2026, 05 Oct 2026, 2026-10-05), **12- or 24-hour time**, the **currency** (USD, EUR, GBP, JPY, CAD, AUD, CHF, INR, LKR, SGD), the **number style** (1,234.56 or 1.234,56 or with spaces) and the **first day of the week** in calendars and weekly reports. The page previews the result as you choose. The **time zone** is the same one as in Company settings and is used for schedules, such as when preventive maintenance falls due; dates and times on screen are shown in each person's own device time.

Not covered yet: **language**. There are no translations, so the page does not offer a language (it is on the roadmap as "Language support"). The resolution heat map in the reports still starts its weeks on Monday whatever is chosen, a few small date labels (such as month names in some charts) keep their own style, and labor cost is still worked out at a fixed 40 per hour whatever the currency.

## Branding

**Settings → Branding** (administrators) puts the company's own look on the install: a **logo** (shown in the sidebar and on the sign-in page), a **favicon**, one **primary colour** that restyles the whole app (buttons, links, highlights), and the **headline and subtitle** on the sign-in page. The colour is shown on the page as you pick it, and it must be dark enough for white text to be readable on it (the page tells you if it is not). Logos are PNG, JPEG or WebP up to 2 MB; favicons PNG or ICO up to 512 KB. SVG is not accepted, as it can carry scripts. The branding is public by design, because the sign-in page needs it before anyone has signed in.
