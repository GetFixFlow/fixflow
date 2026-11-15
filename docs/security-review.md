# Security review before 1.0

FixFlow keeps a company's maintenance records, and its people's names, wages and sign-ins, on the company's own server. This page says **what has been checked, what was found, and what is still open**. It is kept up to date, and it is where the summary of the independent review will be published.

## Where this stands

| Review | Status |
| --- | --- |
| **Internal review** (a systematic read of the code, with every finding checked against the running application) | **Done, 15 November 2026.** Findings below; everything rated high or medium that was confirmed is fixed and has a test that fails without the fix. |
| **Independent review** (by a person or firm that did not write FixFlow) | **Not done yet.** FixFlow 1.0 waits for it. The brief for the reviewer is [below](#brief-for-the-independent-reviewer). |
| **Open high or critical findings** | **None known.** The independent review may find some; version 1.0 is released only when none is open. |

!!! warning "What the internal review is not"
    It was done by the project's own developers and by automated reading of the code, with the findings tried against a running copy. It is a way to remove the problems that are easy to find, so that an independent reviewer's time goes on the hard ones. It does not replace one.

## What the internal review covered

Three passes, each with its own checklist, over the whole API and the web app:

1. **Who may see and do what**: every controller action, the role of the person asking, one company's data against another's, one site's against another's, live-update channels, uploaded files, the assistant.
2. **What the server sends and takes in**: every outbound request (webhooks, chat, plugins, the company directory, the assistant's provider, push), uploads and exports, SQL, spreadsheet formulas, emails, redirects, and the web app's handling of text it is given.
3. **Signing in and what needs no sign-in**: tokens and their ending, two-factor sign-in, password reset and invitations, the first-run setup, OpenID Connect and LDAP, the public request form, API keys and sensor messages, rate limits.

Not covered: the host, the network and the Docker or Kubernetes installation around FixFlow (see [Keeping your own install safe](https://github.com/GetFixFlow/fixflow/blob/main/SECURITY.md)), third-party services, and the plugins a company installs itself.

## What was found, and what was done

| Severity | Finding | Status |
| --- | --- | --- |
| High | **Any signed-in person, a requester included, could take over any work order** ("Assign to me" had no role or ownership check), and so start it, complete it and take parts from stock. | Fixed. Only technicians and above, and only for a work order nobody has. |
| High | **A requester could read every work order in the company**, with its comments, photos and parts, and add comments and photos to any of them. The documented rule is "own requests only". | Fixed. A requester sees only their own requests; another's is "not found". |
| Medium | **Anyone, without signing in, could start an upload** to the file storage (`/api/v1/storage/direct_uploads`), filling the disk or the bucket. | Fixed. FixFlow does not use direct uploads; the two routes now refuse. |
| Medium | **Sign-in, password-reset and public-form limits could be walked round** by adding `.json` or a slash to the address, and the AI and password-change limits by adding words after the token. | Fixed. The limits count what the router reads, and a caller by their token. |
| Medium | **A cookie session was started beside the token** for two-factor, directory and LDAP sign-ins, and was not ended by signing out, ending a session, or an administrator's reset. | Fixed. A sign-in is the token alone. |
| Medium | **A manager could plant script in the QR print window** (an asset's name was written into it as HTML) and run it as an administrator who clicked Print. | Fixed, and a Content-Security-Policy now stops inline script in the web app as a second line. |
| Medium | **Internal notes** on a work order were shown to technicians on the work order's own page. | Fixed. |
| Medium | **A person at one site could read other sites' records** in the audit log and the dashboard's recent activity, and be emailed a report made by an administrator that showed every site. A part at another site could be put on a purchase order. | Fixed. |
| Medium | **LDAP sign-in did not count wrong passwords** against a FixFlow account, so its password could be guessed without the account locking. | Fixed. Counted, and locked, as at the ordinary sign-in. |
| Medium | **The live-update connection outlived the sign-in** and the token was written to the web server's access log. | Fixed. Connections are closed when a sign-in ends; the log redacts the token. |
| Low | A technician could price the parts on a job; a requester could skip a maintenance run; anyone could read the company's default hourly rate and the approval limit, or another person's details; a requester could use the AI assistant and the sensor screens; a technician or requester could choose who a work order was assigned to when creating or editing it. | Fixed. |
| Low | The "send a test" buttons for email and the company directory could carry a saved password to any server typed in. | Fixed. A saved secret is not sent to a new server. |
| Low | A webhook, chat or plugin address was looked up twice: once to check it and once to connect, so a name that answers differently the second time could reach a refused address. | Fixed. The address checked is the one used. |
| Low | `PUT` and `DELETE` on the sign-up address changed or deleted one's own account, skipping the checks of Users and My Profile. | Fixed. The routes are gone. |
| Low | Signed file links never expired; sensor messages had no size limit; codes were not kept out of the application log; a dead, unrouted controller held a shared sensor key. | Fixed. Links last a week; 256 KB limit; filtered; removed. |

Each fix has a test in the suite (`spec/requests/api/v1/role_access_spec.rb`, `site_privacy_spec.rb`, `storage_routes_spec.rb`, and others named in the pull request) that fails without it, and the web app's header and the print window were tried in a real browser.

### Reported and not confirmed

- *"Most report exports skip the spreadsheet-formula guard."* Not so: every export goes through the guard; a test now covers every export and column that holds text.
- *"The ordinary sign-in leaves a session cookie that outlives the token."* Not so for the password sign-in (the cookie only existed for the sign-ins above, now fixed).

## Known limits

These are real, are not fixed in this release, and are written down so you can decide what they mean for you.

| Limit | What it means | What to do |
| --- | --- | --- |
| **The sensor broker has one shared login** and no per-device permissions or TLS. | Whoever has the password can publish readings for any asset and read every device's messages. | Keep port 1883 off the internet and untrusted networks ([Sensors and IoT](iot.md)). Per-device logins and TLS are not built yet. |
| **A link to a photo or document works without signing in** until it expires (a week). | Someone who gets the link (a log, a forwarded message) can open that one file. | Treat links like the files; the independent review will look at whether serving files through the signed-in API is worth the cost. |
| **Per-address limits can be spoofed from inside a private network.** The web server passes on `X-Forwarded-For`, and a person on the same private network can send their own. | They can get round the *per-address* sign-in limits. The *per-account* lock (ten wrong passwords) still holds. | Put a proxy in front that sets `X-Forwarded-For` itself (overwriting what the client sent), or limit who can reach the install. |
| **The sign-in token is kept in the browser** (local storage), as for most single-page apps. | A script that runs in the page can read it. | The Content-Security-Policy and the escaping fixed above are the defence; keep the browser and the install up to date. |
| **A company directory's discovery address is not checked as a webhook's is.** | An administrator can make the server call a loopback or internal address (they can already point a webhook at the company network by design). | Administrators only; the review will decide whether to restrict it. |
| **A person's push address is not pinned to the address checked.** | In theory a name could change between check and use; the push address must be `https` with a valid certificate for that name, which makes it hard to use. | None needed; to be tightened. |
| **The "locked" message and a sign-in's timing tell someone an email address has an account.** | An address can be confirmed to exist. | Use two-factor sign-in; it is not a way in. |
| **A public request's email address is mailed to** when the request's status changes. | A stranger can have FixFlow's mail server send a few status emails to an address they typed, within the limits on public requests. | Switch the public form off under Settings, Advanced Settings ([Work orders](work-orders.md)). |
| **Things reported as suspected and not tested:** an LDAP user who can edit their own `mail` attribute and another company account with that address; OpenID Connect identities are not tied to one issuer if the issuer is changed later; a login code is not tied to the browser that began the flow; stock forecasts count use at sites a person cannot see. | Each needs a particular setup to matter. | The independent review is asked to look at them first. |

## Brief for the independent reviewer

**What FixFlow is.** A self-hosted maintenance-management (CMMS) system for one company per install: a Rails API with PostgreSQL and Redis, Sidekiq workers, S3-compatible file storage, an MQTT broker for sensors, and a React web app served by nginx. It is installed with Docker Compose or the [Kubernetes chart](kubernetes.md). The source is public, so please test as an informed attacker would.

**Roles.** Administrator, manager, technician and requester ([People and roles](users.md#roles-and-permissions)), and optional [sites](sites.md) that limit people to some of the company's places. **Without an account**: the public request form (`/api/v1/work_requests`, `/api/v1/public_assets/:code`), sensor ingestion by API key, and the sign-in, reset, invitation and first-run setup addresses.

**In scope.**

- Authentication and session handling: the token, its ending, two-factor sign-in, reset and invitations, OpenID Connect and LDAP sign-in, API keys.
- Authorization: every role and site boundary; reaching what a role should not.
- The public form, the sensor paths (HTTP and MQTT), the public API and webhooks (signing, address checks).
- Uploads, downloads, exports and the files' storage; the backup and restore tools; the plugin system.
- Injection of every kind (SQL, command, template, header, spreadsheet formula), cross-site scripting and request forgery against the web app, and the web app's own server settings.
- Anything that lets one company's data reach another's, if two companies are ever on one install.
- A fresh install's defaults: secrets, open ports, example values.

**Out of scope.** Volume denial of service, attacks on the host or the network around the install, social engineering, and third-party services (a mail provider, an identity provider, S3). Plugins written by the company itself, except the plugin loading and the ways a plugin is given the network.

**What to read first.** [Sign-in and security](security.md), [People and roles](users.md), [Public API](public-api.md), [Backups](backups.md), [Plugins](plugins.md) and this page. Look hardest at **the limits above marked as not tested**.

**Set-up.** `docker-compose.prod.yml` (see [Install](install.md)) with `SEED_DB=true` gives demo accounts for every role. A copy with a company-sized dataset can be provided. Testing may be done against the reviewer's own install; please do not test on a company's live install.

**What we ask for.** A written report with each finding's severity (CVSS or high/medium/low, with the reasoning), steps to reproduce, and a recommended fix; a retest of the fixes; and permission to publish a summary (below). We will credit the reviewer if they wish. A vulnerability found is handled as in [the security policy](https://github.com/GetFixFlow/fixflow/blob/main/SECURITY.md): reported privately to the maintainers, fixed, then disclosed.

**When it is done.** Every high and critical finding is fixed and retested; every medium one is fixed or has a written reason on this page; and the summary below is filled in.

## Summary of the independent review

*Not yet done.* When it is, this section will say who did it, when, what was in scope, how many findings there were of each severity, which are fixed and which are open and why, and what was not covered. The full report may contain details of fixes not yet installed by everyone, so only the summary is published.

| | |
| --- | --- |
| Reviewer | — |
| Date | — |
| Version reviewed | — |
| Findings (critical / high / medium / low) | — |
| Open at release | — |
