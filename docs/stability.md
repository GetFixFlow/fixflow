# Stability and the upgrade promise

What **version 1.0** promises a company that builds on FixFlow: which parts do not change, what "not change" means, how an upgrade works, and how long a version gets fixes.

!!! note "FixFlow is not at 1.0 yet"
    This page is what 1.0 will promise. Until it is released, a new version (`0.4.0` to `0.5.0`) may still change any of this, and the [changelog](changelog.md) says when it does. The checks that hold the promise are already running, against a record of the stable parts taken on 17 November 2026, so a change that would break it is caught now, not after 1.0.

## What is stable

These are the parts a company's own programs depend on. Within 1.x they only grow.

| Part | What does not change | Where it is described |
| --- | --- | --- |
| **The public API** (`/api/v1/open`) | Its addresses, what each accepts (parameters, fields, the choices a field may take), what each answers (fields and their types), and the status of each answer | [Public API](public-api.md); the description for tools is at `/api/v1/open/openapi` |
| **Sensor readings** (`POST /api/v1/iot/ingest`) | The three forms of a message (one reading, several from one device, a list), the asset named by `asset_id` or `asset_tag`, and the answer | [Sensors and IoT](iot.md) |
| **Webhooks** | The event names, the four `X-FixFlow-` headers, and the fields of each message and of the record inside it | [Webhooks](public-api.md#webhooks) |
| **The health check** (`GET /api/v1/health`) | That it answers, and its fields | [Watching the install](monitoring.md) |
| **Settings in `.env`** | The name and meaning of every setting listed in `.env.example` | [Configuration](configuration.md) |
| **Your data** | Every upgrade within 1.x moves it to the new version by itself (see [below](#upgrading-within-1x)) | [Upgrading](upgrading.md) |

[API endpoints](api-endpoints.md) marks each endpoint **Stable** or **Web app**.

**Kept, but no test checks it yet:** the MQTT topic a device publishes to (`fixflow/<company token>/assets/<asset>/telemetry`, [Sensors and IoT](iot.md#mqtt)).

## What is not covered

- **The rest of the API**, which is the web app's own: sign-in, the screens' data, settings and everything else that is not marked **Stable**. The web app and the server are released together, so the web app always matches the server it came with. They change when the web app does, and the changelog says so; a program should not depend on them. Use the public API.
- **The database itself.** Reading the tables with SQL works today and may stop working in any release; the public API and webhooks are the way out.
- **Plugins** ([Plugins](plugins.md)). The extension points are not yet held by a test, so a plugin may need a change in a 1.x release; the changelog says so.
- **How it looks**: screens, wording, emails and report layouts.

## What "does not change" means

In 1.x, for the stable parts, these **can** happen in any release:

- A new field in an answer, a new endpoint, a new optional parameter, a new webhook event or header, a new setting.
- A new value in a list of choices an answer may hold (a new work order status, for example).

So a program should **ignore fields it does not know, and tolerate a value it has not seen**. A program that does this keeps working for all of 1.x.

These **cannot** happen in 1.x:

- Removing or renaming an endpoint, a field, a parameter, a webhook event, a header or a setting.
- Changing the type of a field, or making an optional field empty (null) when it never was.
- Making an optional parameter required, or no longer accepting a value that was accepted.
- Changing the status an answer is sent with.

**One exception: a security fix.** If a hole can only be closed by refusing something that used to be accepted, it is closed in the next release, and the release notes and the security advisory say what changed. This has happened before 1.0 (see [Security review before 1.0](security-review.md)) and will be rare, and the fix is the narrowest that closes the hole.

A change that cannot be made by adding needs **FixFlow 2.0**, and for the public API a new version at a new address (`/api/v2/open`), served **beside** `/api/v1/open` for at least **twelve months** after 2.0 is released, with a notice in the changelog from the release that announces it.

## Upgrading within 1.x

- **Nothing to do beyond the notes.** Each release's notes start with **Before you upgrade** when there is something you must do (a new setting, a command, signing in again). With none, `make upgrade` is all.
- **Your data is migrated by the upgrade.** The database migrations run when the new version starts. A change to how data is kept never needs an export and an import by hand.
- **It is tried on every change.** CI starts the previous release with data in it, upgrades it, checks the data, rolls back and checks the old version is back (`bin/check_upgrade`, described in [Upgrading](upgrading.md)).
- **Skipping releases is allowed, and not tried.** Migrations run in order, so going from 1.2 to 1.5 works the same way, but read the **Before you upgrade** list of every release you skipped. CI tests one step at a time.
- **Going back** is a rollback to the backup the upgrade took (`make rollback`), not a downgrade: a migration cannot be undone, so what was entered after the upgrade is lost.

## Which versions get fixes

**The newest 1.x release gets every fix, security or not.** Older ones do not. Every release within 1.x is compatible with the one before and upgrades itself, so *upgrading is the fix*; there is no reason to stay behind and no fix-by-fix choosing to do.

When 2.0 is released, **the last 1.x release gets security fixes for at least twelve months**, the same as the public API's overlap above.

A company that has to stay on an older version, because of its own change rules, can ask for that to be covered in a [support contract](support.md#support-contract). It is agreed in writing and is not part of the free project.

Releases come out on the [first Tuesday of every month](support.md#when-new-versions-come-out).

## How the promise is kept

For people who change FixFlow ([Contributing](https://github.com/GetFixFlow/fixflow/blob/main/CONTRIBUTING.md)):

- `spec/contracts/api_1_0_baseline.json` records the stable parts: the routes, every parameter and field with its type, the webhook events and headers, the settings in `.env.example`, and the shape of real answers (made by sending real requests to a test server). `spec/contracts/stable_api_spec.rb` compares them with the code and **fails when anything in the baseline is gone or has changed type**.
- If it fails, the change breaks the promise. Keep the old field and add the new one, or accept the old and the new value.
- If a change only **adds** something, record it: `UPDATE_API_BASELINE=1 bundle exec rspec spec/contracts/stable_api_spec.rb`. That refuses to write when anything would be lost, so it cannot be used to hide a break.
- Which endpoints are stable is one list, in `lib/fixflow_api_docs.rb`; the endpoint page and the baseline both read it.
