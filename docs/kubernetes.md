# Install on Kubernetes

FixFlow has a **Helm chart** for a Kubernetes cluster: the web app and API (two copies each, by default), the background workers, and, if you want them, the database, Redis, file storage and sensor broker. For a company that already runs Kubernetes, or that needs more than one application server, this is the way to run FixFlow beside everything else.

For one server, the [Docker install](install.md) is simpler and is what most companies need. For an install that has to **stay up** when a server or a database copy is lost, read [Staying up](high-availability.md) as well: this page installs the chart, that one says what to run underneath it.

!!! note "Where the chart is"
    The chart is in the repository, at `deploy/helm/fixflow`, and each release has its version of it (the chart's version is the FixFlow release it installs). It is not yet published to a chart repository: clone the repository at the release you want (`git clone --branch v0.1.0 https://github.com/GetFixFlow/fixflow.git`) and install from the folder.

## What you need

- **Kubernetes 1.25 or newer**, and **Helm 3**.
- An **Ingress controller** (ingress-nginx, Traefik, a cloud one...). The chart's Ingress does what the web image's own nginx does for a Docker install: `/api` and `/cable` (the WebSocket for live updates) go to the API, everything else to the web app. Without one, send those paths to the services yourself ([Getting in](#getting-in)).
- A **default StorageClass**, if you let the chart run its own database, Redis, file storage and sensor broker (each one gets a disk).
- A DNS name for FixFlow, pointing at the Ingress controller.

## Install

```bash
helm install fixflow ./deploy/helm/fixflow --namespace fixflow --create-namespace \
  --set appUrl=https://fixflow.example.com \
  --set secrets.secretKeyBase=$(openssl rand -hex 64) \
  --set secrets.deviseJwtSecretKey=$(openssl rand -hex 48) \
  --set secrets.dbPassword=$(openssl rand -hex 24) \
  --set secrets.redisPassword=$(openssl rand -hex 24) \
  --set secrets.s3AccessKey=$(openssl rand -hex 10) \
  --set secrets.s3SecretKey=$(openssl rand -hex 24) \
  --set secrets.mqttPassword=$(openssl rand -hex 24)
```

The first start migrates the database, which can take a few minutes. Watch it, then check it:

```bash
kubectl -n fixflow get pods -w
helm test fixflow -n fixflow        # asks the API (which checks the database and Redis) and the web service
```

Open the address you gave as `appUrl`: the first-run screen asks for the company and the first administrator, as on the [Docker install](install.md). Then Settings, System Health should show everything working.

**Keep the passwords.** The values above are made up once, here, and a later `helm upgrade` must use the same ones (`--reuse-values` does, or a values file does). A different `secrets.secretKeyBase` or `secrets.deviseJwtSecretKey` signs everyone out, and a different `secrets.dbPassword` locks the application out of its own database. Better still, **keep them out of Helm** with a Secret of your own ([Secrets](#secrets)).

## What runs

| Part | Kind | Copies | Notes |
| --- | --- | --- | --- |
| Web (the app's files) | Deployment | 2 | `web.replicas`; stateless |
| API | Deployment | 2 | `api.replicas`; stateless, so any copy answers any request; runs the database migrations when it starts |
| Workers | Deployment | 2 | `sidekiq.replicas`: email, preventive maintenance, the nightly backup, cleanups. Each scheduled job is queued once, however many workers there are |
| **Sensor listener** | Deployment | **exactly 1** | One worker that also listens to the sensor broker. It is never scaled and is replaced, not added to, when upgraded (see below) |
| PostgreSQL | StatefulSet | 1 | Optional (`postgresql.enabled`); one copy with its own disk |
| Redis | StatefulSet | 1 | Optional (`redis.enabled`); one copy with its own disk |
| File storage (SeaweedFS) | StatefulSet | 1 | Optional (`s3.enabled`); photos, documents and backups, in two buckets |
| Sensor broker (Mosquitto) | StatefulSet | 1 | Optional (`mqtt.enabled`) |

**Why exactly one sensor listener.** The sensor broker gives every message to every listener. FixFlow's workers listen by default, so with two workers every sensor reading would be stored twice. The chart turns listening off on the workers and runs one more worker, `sidekiq-iot`, with it on (and with the `Recreate` strategy, so the old one stops before the new one starts). With no broker (`mqtt.enabled: false` and no `mqtt.external.host`) there is no listener at all; readings can still arrive over [HTTP](iot.md).

**The ones you run in the cluster are single copies.** They are enough to try FixFlow or to run a small install, but if one's node or disk is lost, FixFlow stops until it is back, and the data on a lost disk is gone. For a company that needs more, turn each off and point FixFlow at one you run or rent: [Staying up](high-availability.md) says which.

## Settings

Everything is in `deploy/helm/fixflow/values.yaml`, with a comment on each. The ones you will reach for:

| Setting | What it does |
| --- | --- |
| `appUrl` | The address people open FixFlow at (required, with no slash at the end) |
| `image.repository`, `image.tag` | A mirror of the images (`ghcr.io/getfixflow` by default); the tag is the release the chart is, and should not be changed to `latest` |
| `existingSecret`, `secrets.*` | [The secrets](#secrets) |
| `env` | Any other setting from [Configuration](configuration.md), as `name: value` (for example `MAILER_FROM`, `SMTP_HOST`, `AI_ENABLED`) |
| `extraEnvFrom` | Secrets or ConfigMaps whose keys become settings: a place for `SMTP_PASSWORD` and `ANTHROPIC_API_KEY` |
| `ingress.*` | [Getting in](#getting-in) |
| `web.*`, `api.*`, `sidekiq.*` | Copies, resources and autoscaling |
| `postgresql.*`, `redis.*`, `s3.*`, `mqtt.*`, `storage.*` | Run it here (disk size, StorageClass) or point at one outside |
| `podDisruptionBudget.enabled`, `spread.enabled` | Keep one copy up during a node drain; prefer different nodes |
| `nodeSelector`, `tolerations`, `affinity` | Where the application's pods may run |
| `plugins.existingClaim` | A PersistentVolumeClaim whose files are the [plugins](plugins.md) folder |

For example, a values file for mail and AI:

```yaml
appUrl: https://fixflow.example.com
env:
  MAILER_FROM: maintenance@example.com
  SMTP_HOST: smtp.example.com
  SMTP_USERNAME: fixflow
extraEnvFrom:
  - secretRef:
      name: fixflow-smtp        # has the key SMTP_PASSWORD
```

### Secrets

By default the chart makes one Secret from the `secrets.*` values. That puts the passwords in Helm's release history and in any values file you keep, so for a real install **make the Secret yourself** and name it:

```bash
kubectl -n fixflow create secret generic fixflow-secrets \
  --from-literal=SECRET_KEY_BASE=$(openssl rand -hex 64) \
  --from-literal=DEVISE_JWT_SECRET_KEY=$(openssl rand -hex 48) \
  --from-literal=DB_PASSWORD=$(openssl rand -hex 24) \
  --from-literal=REDIS_PASSWORD=$(openssl rand -hex 24) \
  --from-literal=MINIO_ACCESS_KEY=$(openssl rand -hex 10) \
  --from-literal=MINIO_SECRET_KEY=$(openssl rand -hex 24) \
  --from-literal=MQTT_PASSWORD=$(openssl rand -hex 24)

helm install fixflow ./deploy/helm/fixflow -n fixflow --create-namespace \
  --set appUrl=https://fixflow.example.com --set existingSecret=fixflow-secrets
```

The keys are the setting names. With a database outside the cluster the Secret has `DATABASE_URL` (`postgres://user:password@host:5432/dbname`) instead of `DB_PASSWORD`, and with Redis outside it has `REDIS_URL` instead of `REDIS_PASSWORD`. The database and Redis passwords must be letters and digits only (`openssl rand -hex` is), because they are part of an address. Tools that sync secrets from a vault (External Secrets, Sealed Secrets...) work the same way: they make this Secret.

Changing the Secret's values does not restart the pods by itself when you manage it yourself: run `kubectl -n fixflow rollout restart deploy` after it. (With the chart's own Secret, `helm upgrade` does.)

## Getting in

The chart makes an Ingress for the address in `appUrl`. For HTTPS, give it a certificate:

```yaml
ingress:
  className: nginx
  tls:
    enabled: true
    secretName: fixflow-tls            # cert-manager fills it in when the Ingress has its annotation
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt
```

The chart's own annotations are what **ingress-nginx** needs, and they stay when you add yours (Helm merges the two): an upload can be 50 MB (`proxy-body-size`), and the live-updates WebSocket (`/cable`) stays open for hours (`proxy-read-timeout` and `proxy-send-timeout`, an hour). **Another controller needs its own settings for the same two things**: a body size of at least 50 MB, and a read timeout for `/cable` of an hour or more. Without the second one, live updates (a new alert appearing on a screen) stop working while everything else does. Other controllers ignore the ingress-nginx annotations; to remove them, set each to `null`.

Without an Ingress at all (`ingress.enabled: false`), send `<appUrl>/api` and `<appUrl>/cable` to the service `fixflow-api` on port 3000 and everything else to `fixflow-web` on port 80, with your controller, Gateway or load balancer; pass `X-Forwarded-Proto: https` for HTTPS.

## Sensors

Sensors inside the cluster connect to the service `fixflow-mqtt` on port 1883. Sensors outside need a way in: set `mqtt.service.type` to `LoadBalancer` (or `NodePort`) and give the sensors the login `mqtt.username` and `secrets.mqttPassword`. Sensor traffic is plain MQTT; do not expose it to the internet without a TLS-terminating load balancer or a VPN in front. See [Sensors and IoT](iot.md).

## Upgrading

The chart's version is FixFlow's. To upgrade, get the chart of the new release and:

```bash
helm upgrade fixflow ./deploy/helm/fixflow -n fixflow --reuse-values
```

New API servers are started before old ones are stopped (never fewer than were running), so the front door keeps answering; the first new server migrates the database. Read the release's **Upgrade** line in the [changelog](changelog.md) first, as for any upgrade. Two things differ from the [Docker upgrade](upgrading.md):

- **The old servers keep answering while the new one migrates**, so the chart cannot promise that a migration will never meet an old server. The release notes say when a release needs more care.
- **There is no automatic backup before an upgrade.** Take one first: `kubectl -n fixflow exec deploy/fixflow-api -- bundle exec rails fixflow:backup`.

`helm rollback` returns the **images** to the previous release; it does not undo what the migration did to the database. To go back fully, roll back and then [restore](#backups-and-restoring) the backup you took.

## Backups and restoring

The nightly database backup runs as it does everywhere (the workers, at 03:00 UTC, into the `backupBucket` of the file storage; see [Backups](backups.md)). **If the file storage is the one inside the cluster, its backups are on a disk of the same cluster**, so also copy them elsewhere (`BACKUP_S3_*` in `env` and `extraEnvFrom` sends them to another S3 storage), or use a file storage outside the cluster.

Restoring needs the web and worker pods stopped and is done with a command in an API pod. These are the steps the `kubernetes` check in CI runs (with the names of a release called `fixflow`):

```bash
# 1. Close the front door, stop the web and worker pods, and keep one API pod to run the command in
helm upgrade fixflow ./deploy/helm/fixflow -n fixflow --reuse-values --set ingress.enabled=false
kubectl -n fixflow scale deploy/fixflow-web deploy/fixflow-sidekiq deploy/fixflow-sidekiq-iot --replicas=0
kubectl -n fixflow scale deploy/fixflow-api --replicas=1

# 2. Restore (REPLACE=yes: the API's start-up has already made empty tables)
kubectl -n fixflow exec deploy/fixflow-api -- env REPLACE=yes bundle exec rails "fixflow:restore[latest]"

# 3. Start everything again, with the number of copies you run
kubectl -n fixflow scale deploy/fixflow-web deploy/fixflow-api deploy/fixflow-sidekiq --replicas=2
kubectl -n fixflow scale deploy/fixflow-sidekiq-iot --replicas=1
helm upgrade fixflow ./deploy/helm/fixflow -n fixflow --reuse-values
```

`latest` is the newest backup; `rails fixflow:backups` lists them, and [Backups](backups.md) says what the command does and checks. With autoscaling on, leave the number of copies to it.

## Uninstalling

```bash
helm uninstall fixflow -n fixflow
```

This leaves the **disks** (PersistentVolumeClaims) of the database, Redis, file storage and sensor broker, and so the data, in the cluster. Delete them yourself (`kubectl -n fixflow delete pvc --all`) only when you are sure you want the data gone.

## What is checked

CI runs two checks on every change to FixFlow:

- **`bin/check_helm`** lints the chart and renders it the ways it is used, and checks that the result is valid Kubernetes, that exactly one worker listens to the sensor broker however many workers there are, that no password is written into anything but the Secret, that a change to a setting or secret restarts the pods, and that an install that cannot work is refused with a message that says what to set.
- **`bin/check_kubernetes`** installs the chart on a real cluster (kind) from images built from the change, behind an Ingress controller, and checks first-run setup and sign-in, the WebSocket, System Health, a file in the bundled storage and `helm test`; sends one message to the sensor broker with several workers running and checks it is received once; kills one of the two API servers and checks the other keeps answering; upgrades with new settings while checking the API keeps answering; and takes a backup, changes data, restores, and checks the change is undone.

It does not check the chart with a database, Redis or file storage **outside** the cluster (the chart is rendered that way and checked as Kubernetes, but not run), on a cluster with more than one node, or with an Ingress controller other than ingress-nginx.
