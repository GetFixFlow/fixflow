# FixFlow documentation

FixFlow is an open-source maintenance management system (a CMMS) that you run on your own server: work orders, preventive maintenance, assets and places, parts, sensors and reports, in a web app that also works on a phone.

These pages are for the person who **installs and looks after** a FixFlow server, and for the people who use it. Each page is checked against the code in the same change that alters the behaviour, and the version of this site is the version of FixFlow it describes.

## Start here

1. **[Install on a server](install.md)**: Docker on a Linux server, about two gigabytes of memory (or the [lite install](lite.md), with no storage server or sensor broker). One script does it on a fresh Ubuntu server, and there are step-by-step guides for [DigitalOcean](server-digitalocean.md), [AWS](server-aws.md) and [a server inside the company network](server-company-network.md). Then [HTTPS](https.md) so passwords and phones' cameras work.
2. **[Configuration](configuration.md)**: the settings in `.env`, what the server checks when it starts, and email.
3. **[People and roles](users.md)** and **[Sign-in and security](security.md)**: invite your team, and switch on two-factor sign-in.
4. **[Importing data](import.md)**: bring places, assets and parts in from a spreadsheet, or add sample data to look around.
5. **[Backups](backups.md)**: set where they go **before** you rely on the install.

## Keeping it running

| I want to... | Read |
| --- | --- |
| Move to a new version, or go back | [Upgrading and rolling back](upgrading.md) |
| Back up and restore | [Backups and restoring](backups.md) |
| See whether everything works | [Watching the install](monitoring.md) |
| Fix something that is not working | [Troubleshooting](troubleshooting.md) |
| Know what changed in a release | [Changelog](changelog.md) |

## Using FixFlow

| I want to... | Read |
| --- | --- |
| Start as a technician, on a phone | [Quick start for technicians](technician.md) |
| Set up the company in the first week | [Administrator guide](administrator.md) |
| Run work orders, checklists and QR-label requests | [Work orders and maintenance](work-orders.md) |
| Count hours or kilometres and service by the count | [Meters and usage-based maintenance](meters.md) |
| Keep a list of contractors and give them work | [Vendors and contractors](vendors.md) |
| Ask for parts, approve, order and receive them | [Purchasing parts](purchasing.md) |
| Connect sensors and set alert rules | [Sensors and IoT](iot.md) |
| Understand the reports and the dashboard | [Reports and the dashboard](reports.md) |
| Get messages on a phone when work is assigned | [Notifications](notifications.md) |
| Connect another program | [API](api.md) and [API endpoints](api-endpoints.md) |

## Helping with FixFlow

[Development](development.md) is how to run it from source and run the tests. The repository's [CONTRIBUTING.md](https://github.com/GetFixFlow/fixflow/blob/main/CONTRIBUTING.md) says what a pull request needs. Security problems are reported privately: see [SECURITY.md](https://github.com/GetFixFlow/fixflow/blob/main/SECURITY.md).

!!! info "What these pages do not cover yet"
    The guides for technicians and administrators have no screenshots yet, and there is no page that goes through every screen. The install has been checked on Docker Desktop and in CI, not yet on a fresh server by someone outside the project: if anything in these pages was missing, wrong or confusing, please [open an issue](https://github.com/GetFixFlow/fixflow/issues).
