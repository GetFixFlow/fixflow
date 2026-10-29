# Development

Run FixFlow from source, run the tests, and how the pieces fit.

## Local Development (without Docker)

### Prerequisites
- Ruby 3.3+
- Node.js 20+
- PostgreSQL 16
- Redis 7
- Bundler 2.5+

### API (Rails)

```bash
git clone https://github.com/GetFixFlow/fixflow.git
cd fixflow
bundle install
cp .env.example .env
# Edit .env with your local Postgres/Redis credentials

bundle exec rails db:create db:migrate
bundle exec rails db:seed     # optional: seeds demo data

bundle exec rails server      # API on :3000
bundle exec sidekiq           # Background workers
```

### Frontend (React)

```bash
cd apps/web
npm install --legacy-peer-deps
cp .env.example .env.local
# Set VITE_API_URL=http://localhost:3000/api/v1

npm run dev     # Dev server on :3001
```

### Frontend Environment Variables

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | `http://localhost:3000/api/v1` | Rails API base URL |
| `VITE_WS_URL` | `ws://localhost:3000/cable` | ActionCable WebSocket URL |
| `VITE_APP_ENV` | `development` | Application environment |

## Development with Docker

```bash
docker compose up -d       # the API, a worker, PostgreSQL, Redis and an S3 server, with no configuration
docker compose exec api bundle exec rails db:create db:migrate db:seed
```

The API is on `http://localhost:3000` and the S3 server on `http://localhost:8333` (login `minioadmin` / `minioadmin`). The web app is run with npm; see [Local Development](#local-development-without-docker). This is a different stack from the production one (`docker-compose.yml` and `docker-compose.prod.yml` are not combined) and uses public, development-only secrets.

## Architecture

```
IoT Devices ──MQTT/REST──► FixFlow API (Rails 8)
                                  |
                    +─────────────+─────────────+
                    |             |             |
              PostgreSQL       Redis          S3 storage
             (core data)    (Sidekiq)    (file storage)
```

**Stack:**
- **API**: Ruby on Rails 8, API mode
- **Auth**: Devise + devise-jwt (Bearer JWT)
- **Jobs**: Sidekiq + Redis
- **Storage**: ActiveStorage → an S3-compatible server (SeaweedFS in the Docker install)
- **IoT**: REST webhook + MQTT-compatible ingestion
- **Serialization**: Blueprinter
- **Pagination**: Pagy

## Running Tests

### API (RSpec)

```bash
bundle exec rspec
bundle exec rspec spec/requests/   # request specs only
bundle exec rspec spec/models/     # model specs only
```

These run in CI on every pull request (the `test` job: a real PostgreSQL 16 and Redis 7, the schema loaded fresh, `bundle exec rspec`), so a change that breaks one cannot be merged unnoticed. They need PostgreSQL and Redis running (Redis for `rake fixflow:stats`, which reports on it), but no mail server or API key.

### Frontend (Vitest)

```bash
cd apps/web
npm run test          # run all tests
npm run test:ui       # Vitest UI
npm run test:coverage # coverage report
```

### Keeping the web app and the API in step

```bash
bin/rails web:check_routes
```

lists every request the web app makes (read from the TypeScript source in `apps/web/src`, through `apiClient`, and the report downloads made with `exportReport('report', 'csv')`) and checks that Rails has a route for each, with the same verb, and that no API route leads to a controller action that does not exist. It needs Node and the web app's dependencies (`npm ci` in `apps/web`), not a database, and it runs in CI. It prints what it finds and exits with an error if the web app and the routes disagree.

If it reports **NO ROUTE**, either the endpoint is missing (build it) or the request should not be there (remove it). **PATH NOT IN THE SOURCE** means a request builds its address from a variable, so it cannot be checked: write the address out. The few requests that cannot be matched on purpose are listed, each with its reason, in `config/web_routes_allowlist.yml`; an entry that is no longer needed is reported too, so the list cannot go stale. The same check is part of `bundle exec rspec spec/lib`.

The check compares addresses and verbs. What the report endpoints send back is checked separately, from both ends: `spec/contracts/report_shapes_spec.rb` builds fixed data, calls each report and compares the response, field by field and kind of value, with a JSON file in `apps/web/src/test/fixtures/reports`; the web tests load the same files into the types the screens read (`apps/web/src/types/reports.ts`) and render the real pages with them. A field renamed on either side fails a test. After changing a report on purpose, regenerate the files with

```bash
UPDATE_REPORT_FIXTURES=1 bundle exec rspec spec/contracts/report_shapes_spec.rb
```

and commit them with the web change. Every report screen (Work Orders, Asset Health, Technician Performance, PM Compliance, IoT Analytics, Cost Analysis) and the dashboard (for each role) is covered. Anything else the web app reads from the server is not, yet.
