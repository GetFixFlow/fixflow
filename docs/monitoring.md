# Watching the install

System Health and the audit log.

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

- Created, changed and deleted: **assets** (a removed asset is *deleted*, and can be *restored*), **locations**, **work orders** (and each step they go through), **PM schedules**, **IoT rules**, **API keys** (a switched-off key is *revoked*) and **people** (*deactivated* and *reactivated* have their own lines).
- **Sign-ins** (who, from where, on what device) and the ending of a signed-in device.
- Changes to the **company's settings** (and branding, date and currency settings, email settings), **imports** (one line for the whole file), parts and stock changes, and loading or removing example data.

**What is not written down.** A change records *which fields* changed, never their values (a value can be a wage, a secret or a customer's text), with one exception: a change of someone's role shows the old and the new role. Passwords appear only as "password changed". Nothing is written for the things the system keeps up to date by itself (a schedule's next due date and counters, how often an IoT rule has fired, sign-in counters, a work order moving through its states beyond the one line each step already writes), for IoT readings and alerts (far too many), or for a failed sign-in. Reports and the dashboards' recent activity show the work, not who signed in. A line is written after the change is saved, so a change that is rolled back leaves none; if writing a line ever fails, the change itself is still saved.

**How long it is kept.** For ever by default; see [Data retention](backups.md#data-retention) to set a limit.
