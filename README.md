<p align="center">
  <img src="docs/logo.png" alt="FixFlow logo" width="220">
</p>

# FixFlow CMMS

> Open-source Computerized Maintenance Management System — self-hostable, IoT-ready, built for the teams that enterprise software forgot.

**v0.1** · Rails 8 API · React 18 PWA · PostgreSQL · Redis

## Tech Stack

| Layer | Technology |
|---|---|
| **API** | Ruby on Rails 8 (API mode) |
| **Frontend** | React 18 + TypeScript + Vite + Tailwind CSS |
| **Database** | PostgreSQL 16 |
| **Cache / Jobs** | Redis 7 + Sidekiq |
| **File Storage** | Any S3-compatible server (SeaweedFS in the Docker install) |
| **Auth** | Devise + devise-jwt (Bearer JWT) |
| **State** | TanStack Query v5 + Zustand v5 |
| **IoT** | REST webhook + MQTT ingestion |

---

## Documentation

**[docs/index.md](docs/index.md)** is the start: installing, configuring, upgrading, backing up, troubleshooting, using FixFlow and the API. The pages are Markdown in [docs/](docs/), and a release also builds them as a searchable website (`pip install -r deploy/docs/requirements.txt`, then `mkdocs serve`, shows it on your machine).

| | |
|---|---|
| [Install on a server](docs/install.md) | Docker on a Linux server, then [HTTPS](docs/https.md) |
| [Configuration](docs/configuration.md) | Every setting, the start-up check, email, branding |
| [Upgrading and rolling back](docs/upgrading.md) | `make upgrade TO=v0.2.0`, and the way back |
| [Backups and restoring](docs/backups.md) | What is backed up, where it goes, how to restore |
| [Troubleshooting](docs/troubleshooting.md) | What to check when something does not work |
| [API](docs/api.md) | Signing in, answers, limits, and [every endpoint](docs/api-endpoints.md) |
| [Development](docs/development.md) | Run it from source, the tests, the architecture |

## Install in four commands

You need a Linux (or macOS) machine with Docker and Docker Compose v2, about 2 GB of memory and a few GB of disk. Nothing else is installed on it.

```bash
git clone https://github.com/GetFixFlow/fixflow.git
cd fixflow
cp .env.example .env
# Fill in the "Required" block of .env. Every line has the command beside it that makes its value (openssl rand -hex 24 ...).
docker compose -f docker-compose.prod.yml up -d --build      # or: make prod
```

The first start builds the images (5 to 10 minutes). Then open the address you put in `APP_URL`: a new install shows **Set up FixFlow**. The page [Install on a server](docs/install.md) has the rest, including what is running and where the data lives. The front door speaks plain HTTP until you turn on [HTTPS](docs/https.md).

---

## Development Roadmap

- **v0.1** (current) — Core CMMS loop: assets, work orders, PM, IoT ingestion
- **v0.2** — Anomaly detection, auto-prioritization
- **v0.3** — Predictive maintenance (RUL estimation)
- **v0.4** — Natural language work order creation

---

## Contributing

Bug reports, ideas, documentation fixes and code are welcome: see [CONTRIBUTING.md](CONTRIBUTING.md) for how to set up, what a pull request needs (a test that fails without the change, an update here and in the CHANGELOG, and an honest list of what was not tried), and the checks CI runs. Everyone taking part follows the [Code of Conduct](CODE_OF_CONDUCT.md). **Security problems are reported privately, not in an issue:** see [SECURITY.md](SECURITY.md). Issues labelled [`good first issue`](https://github.com/GetFixFlow/fixflow/labels/good%20first%20issue) are a good place to start.

---

## License

AGPLv3 — see [LICENSE](LICENSE).
