# Administrator guide: your first week

The order that works for most companies. Each step names the screen and the page that explains it in full. The install itself is [Install on a server](install.md).

## Day 1: make it yours

1. **Create the first account.** The first time you open the address, **Set up FixFlow** asks for the company name and your name, work email and a password (10 or more characters; a few words in a row work well). That account is the administrator.
2. **Settings, Organization**: the company's name, the priority and due date a new request gets, the **work hours, work days and holidays** (they decide how much work a day holds on the [Schedule](schedule.md)), and the **hourly labor rate** that turns recorded hours into cost. Until a rate is set, labor counts as nothing.
3. **Settings, Branding**: your logo, colour and the sign-in page's headline.
4. **Settings, Localization**: how dates, times, numbers and money are shown to everyone.
5. **Settings, Email Settings**: where invitations, resets and notifications are sent from. Without email nothing breaks; you copy invitation links yourself. See [Configuration](configuration.md#email).
6. **Settings, Security**: switch on two-factor sign-in for yourself ([Sign-in and security](security.md)).

## Day 1 as well: backups

Set where backups go **before** you rely on the install, and do one test restore. See [Backups and restoring](backups.md); **Settings, Data Retention** shows the latest backup. **Settings, System Health** shows whether the database, the background jobs, email and file storage are all well.

## Day 2: your places and equipment

- **Import from a spreadsheet**: **Assets, Import CSV**. Places first, then assets, then parts. [Importing data](import.md) has the columns and a template to fill in.
- **Or look around with sample data** first: **Settings, Import / Export, Sample data**, or the *Add sample data* link on the dashboard's Getting started card. **Remove sample data** takes it out again ([Importing data](import.md#sample-data-and-the-first-steps)).
- **Keep the manual with the machine**: open the asset, **Documents**, and add it; set **Warranty expires on** and managers are warned 30 days before ([Asset documents and warranty](asset-documents.md)).
- **Print QR labels**: **Assets, Print labels**. Stick one on each machine. Anyone who scans it can report a problem without an account ([Work orders](work-orders.md#reporting-a-problem-without-an-account-qr-labels)).

## Day 3: your people

**Settings, Users, Invite User**: choose a role for each person and send the link. [People and roles](users.md) says what each role can do; **Settings, Roles & Permissions** shows the whole table. Give every technician the [Quick start for technicians](technician.md).

## Day 4: scheduled maintenance

Under **Preventive Maintenance**, create a schedule for each recurring job: a name, the asset, the priority, how often and when to start, plus a **checklist** so the steps are always the same. It creates the work orders by itself. [Work orders and maintenance](work-orders.md) explains checklists. A job that is done by running hours or kilometres instead of by date follows a **meter** on the asset (**Asset, Meters, Add meter**, then choose *Meter-Based* in the schedule): see [Meters](meters.md). The contractors you use go on the **Vendors** page, with the people to call at each; a work order given to one counts what they charge in the cost reports ([Vendors](vendors.md)). When stock runs low, technicians ask for more on the **Purchasing** page, and you approve, order and record the delivery, which adds to the stock ([Purchasing parts](purchasing.md)).

## Day 5: hear about it

- **Settings, Notifications**: everyone chooses their own emails and push messages. Ask technicians to switch push on their phone ([Notifications](notifications.md)).
- **Settings, Team Chat**: post new problems, assignments and low stock to a Slack or Teams channel ([Notifications](notifications.md#team-chat)).
- **Dashboard** and **Reports**: what is open, what is late, what it costs ([Reports and the dashboard](reports.md)).

## Later

| When | What | Where |
| --- | --- | --- |
| You have sensors | Connect them, set alert rules | **Settings, IoT & API Keys**, [Sensors and IoT](iot.md) |
| A new version is out | Upgrade, or roll back | **Settings, System Health** says when one is out; [Upgrading](upgrading.md) |
| You want to know who changed what | Read the log | **Settings, Audit Log** |
| You want less data kept | Set how long things are kept | **Settings, Data Retention** |
| The public request form is being abused | Turn it off | **Settings, Advanced Settings** |
| Something is wrong | Look it up | [Troubleshooting](troubleshooting.md) |
