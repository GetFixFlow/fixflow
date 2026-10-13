# Changelog

All notable changes to FixFlow CMMS will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

- My Profile now works. New `GET` and `PATCH /api/v1/profile` for name, phone, job title and department (new `users.job_title` and `users.department` columns; run `rails db:migrate`), and `PATCH /api/v1/profile/password`. Changing the password signs you out everywhere: every issued token is revoked, and the page sends you to sign in. Password attempts are limited to 5 a minute.
- The profile page showed a hard-coded organization name ("Demo Manufacturing Co.") for everyone; it now shows yours. The sign-in email is shown read-only, and the profile photo upload is removed until photos are supported.
- The web app now passes the TypeScript check (307 errors before), `npm run build` runs it again, and CI runs it with the web tests and build.
- Fixed work order checklists: ticking a step replaced the whole stored checklist with `{step, completed}`, wiping the instruction text and "required" flags, and the UI looked up items by fields (`id`, `description`) the API does not send. Updates are now merged by step.
- Fixed the asset IoT page passing metric names to a chart that needs each metric's readings, which would throw for any asset with sensor data.
- Removed the asset statuses the API rejects (`maintenance`, `offline`, `retired`) from the web forms and filters, and added the `outdoor` location type.
- Work order parts now show their SKU, and line totals are computed from quantity and unit cost (the API sends neither a part object nor a total).
- CI's Ruby jobs pass again. They had never passed: rubocop could not load its Rails cops (now loaded as plugins, with a baseline of existing offenses in `.rubocop_todo.yml` so new code is checked), `bin/bundler-audit` was missing its gem, and Brakeman insisted on its latest version.
- Security: updated the gems with known advisories (nokogiri, puma, jwt, loofah, rails-html-sanitizer, websocket-driver, net-imap, concurrent-ruby, crass, msgpack, mail, Rails 8.1.3 to 8.1.4 for an Active Storage file-read/code-execution advisory, devise 4.9 to 5.0). Moved from Ruby 3.2, which reached end of life on 2026-03-31, to 3.3.6, matching the Dockerfile. Run `bundle install` after pulling.
- The database backup job now runs `pg_dump` without a shell, so the database name can never be interpreted as a command.
- Fixed `DELETE /api/v1/auth/sign_out` answering 401 "No active session" after a successful logout. The token was revoked, but the client was told it failed.
- Fixed `GET /api/v1/activity_logs` always returning an empty list: it filtered on `params[:action]`, which Rails always sets to the controller action ("index"). The action filter is now `log_action`. (The web Audit Log page still shows sample data and does not call this endpoint yet.)
- Fixed the production API failing to boot. `config/environments/production.rb` selected an Active Storage service (`amazon`) that `storage.yml` does not define, and the class in `app/jobs/iot_rule_evaluator_job.rb` was named `IoTRuleEvaluatorJob`, which Rails' production loader rejects (now `IotRuleEvaluatorJob`).
- MinIO credentials: `storage.yml` now also reads `MINIO_ACCESS_KEY` and `MINIO_SECRET_KEY`, the names `.env.example` and `docker-compose.prod.yml` set. Before, uploads would have used the default `minioadmin` login.
- Demo data is now `rails fixflow:demo_data` and works in any environment, for empty installs only (`CONFIRM=yes` in production). `SEED_DB=true` now works in production; it used to do nothing because the seeds only ran in development. `make demo-data` added.
- `npm run build` no longer runs the type check, so the production web image can build while the existing type errors are cleared. Use `npm run typecheck` (or `make typecheck-web`).
- `.env.example` is now tracked in git. It was ignored, so a fresh clone could not follow `cp .env.example .env`.
- In the production compose file the worker waits for the API to be healthy, so the two no longer race to run migrations.
- Invite users: admins create an invitation from Settings → Users, always get a copyable link, and the link is emailed when SMTP is configured. New accept-invite page where the invitee sets a password. New endpoints `POST /api/v1/users/invite`, `POST /api/v1/users/:id/resend_invitation`, `GET /api/v1/invitations/:token` and `POST /api/v1/invitations/:token/accept`. Only a digest of the token is stored. New `APP_URL` setting. Run `rails db:migrate` to add the invitation columns to `users`.
- Fixed IoT ingestion returning 500 on every request (`Iot::IngestionService` resolved to the wrong namespace), and batch (array) payloads never being recognised.
- Fixed the IoT rule "test" endpoint returning 500 for the same reason, and made it manager-only.
- Fixed saving any API key raising an error, because the string-stripping hook also ran on the array column `scopes`.
- Fixed a non-assignee technician's work order update being saved while returning an error, and any manager being able to delete users. Both actions rendered a 403 and carried on.
- Fixed policy checks crashing for non-admin users (`User#manager?`, `#technician?` and `#requester?` were missing).
- Fixed asset delete returning 500, and deleted assets still showing in the asset list.
- `rails fixflow:create_admin` now sets the required subdomain, and refuses to create a second company.
- First-run setup screen (`/setup`). Public sign-up now closes once a company exists, so a private install can no longer be used to create a second company. New `GET /api/v1/setup/status` endpoint.
- Fixed the sign-up form sending `full_name` while the API requires `first_name` and `last_name`, so sign-up from the web app always failed validation.
- Settings pages: profile, notifications, security, organization, branding, users, roles, IoT, data retention, audit log, import/export, advanced
- Onboarding flow

## [0.1.0] - 2026-06-22

### Added

- **Core CMMS loop**: Assets, Work Orders, Preventive Maintenance scheduling
- **IoT ingestion layer**: REST webhook + MQTT-compatible sensor ingestion with rule engine
- **React 18 PWA frontend**: TypeScript + Vite + Tailwind CSS + TanStack Query v5
- **Assets & Locations UI**: full CRUD, QR code scanning/printing, asset import, location hierarchy
- **Work Orders UI**: list, create, edit, detail views with real-time status updates via ActionCable
- **Preventive Maintenance UI**: PM dashboard, schedule management, compliance tracking
- **Reports & Analytics UI**: 7 report types with Recharts visualisations — work orders, asset health, PM compliance, IoT analytics, technician performance, cost analysis
- **Role-based access control**: Admin, Manager, Technician, Requester roles
- **JWT authentication**: Devise + devise-jwt with Bearer tokens
- **Background jobs**: Sidekiq + Redis for PM schedule processing and notifications
- **File storage**: ActiveStorage backed by MinIO (S3-compatible)
- **Production build**: Multi-stage Docker build, nginx SPA config, docker-compose production stack
- **Performance**: Code-split vendor chunks, lazy-loaded routes, Web Vitals reporting, PWA with service worker caching
