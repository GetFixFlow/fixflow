# Security policy

## Reporting a vulnerability

**Please do not open a public issue, pull request or discussion for a security problem.** Report it privately instead:

1. Go to the repository's **Security** tab and choose **Report a vulnerability** ([direct link](https://github.com/GetFixFlow/fixflow/security/advisories/new)). Only the maintainers can see the report.
2. Say what you found, where, and how to reproduce it: the address or screen, the role you were signed in as (or that you were not signed in), what you did and what happened. A short proof of concept helps. Please do not include real customer data.

If that form is not available, open a public issue that says only that you need a private way to report a security problem, **without any details**, and a maintainer will arrange one.

We aim to reply within 7 days, tell you whether we consider it a vulnerability, and keep you informed until it is fixed. We will credit you in the release notes if you wish, and ask that you give us reasonable time to release a fix before you publish anything.

## Which versions get fixes

FixFlow is before 1.0. Security fixes go into the latest release and the `main` branch only. Please check that the problem is still there on `main` before you report it.

## What we are most interested in

FixFlow is installed by companies on their own servers, so the things that matter most are:

- reaching another person's or another role's data (for example a technician or requester seeing labor costs, reports or other people's work orders);
- signing in as someone else, or keeping access after a session was ended or a person was deactivated;
- the public request form (the QR code on an asset), the IoT ingestion endpoints and the invitation and password-reset links, which are the parts reachable without an account;
- uploaded files and exported spreadsheets (including cells that a spreadsheet would run as a formula);
- running code or reading files on the server, injecting SQL, or cross-site scripting;
- an installation that starts with default or example secrets.

## Out of scope

- Findings that need an administrator's account to do something administrators are allowed to do.
- Missing security headers or settings on a server you set up yourself, unless FixFlow's own configuration causes it.
- Denial of service by sending very large volumes of traffic, and automated scanner output without a demonstrated impact.
- Problems in a dependency that are already public: please report those upstream (we also run `bundler-audit` and `brakeman` on every pull request).

## Keeping your own install safe

The server refuses to start with a missing or example secret, but a few things are up to you: serve FixFlow over HTTPS, keep PostgreSQL, Redis, MinIO and the MQTT broker off the public internet, back up regularly, and update when a release announces a security fix. The README's *Environment Variables* section lists every setting.
