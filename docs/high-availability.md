# Staying up: several servers and a replicated database

A FixFlow install on one server stops when that server does. This page is for the company that cannot have that: it says **what to run underneath the [Kubernetes chart](kubernetes.md)**, part by part, what each part does when it is lost, and what you will see. Read it before you rely on FixFlow staying up, and test it ([Try it before you need it](#try-it-before-you-need-it)); a setup nobody has tried to break is a guess.

!!! warning "What the chart's own database, Redis and storage are"
    With the defaults the chart runs **one copy** of PostgreSQL, Redis, the file storage and the sensor broker, each with a disk. They are for trying FixFlow and for small installs. **They are not highly available**: losing the node or the disk one is on stops FixFlow until it is back, and a lost disk loses its data. For an install that has to stay up, switch each off and point FixFlow at one that is replicated ([Reference setup](#reference-setup)).

## Part by part

| Part | How it stays up | When it is lost |
| --- | --- | --- |
| **Web** | Any number of copies, none holds anything | The others answer. Nothing to do. |
| **API** | Any number of copies. There are no sessions on the server: sign-in is a signed token, checked against the database, and live updates, the cache and the rate limits are shared through Redis | The others answer. Open live-update connections on the lost server reconnect to another. |
| **Workers** | Any number of copies. Each scheduled job (the hourly maintenance run, the nightly backup...) is queued once, however many workers there are | The others carry on. A job a worker was running when its node was lost may not be retried (Sidekiq's free edition cannot recover it); the scheduled ones run again on their next turn. |
| **Sensor listener** | **Exactly one**, by design: it receives every sensor message, so a second would store every reading twice. Kubernetes starts another when it is lost | **Readings sent while there is no listener are lost**, unless the sensors send over [HTTP](iot.md) or keep and resend. A lost pod is replaced in about a minute; a lost *node* only after Kubernetes gives up on it, five minutes by default ([Faster failover for the listener](#faster-failover-for-the-sensor-listener)). |
| **PostgreSQL** | **A replicated database with automatic failover**, outside the chart: [Database](#postgresql) | The API stops answering (it reports "not ready" while it cannot reach the database) for as long as the failover takes, then recovers by itself. |
| **Redis** | **A Redis with automatic failover and an address that follows the primary**, outside the chart: [Redis](#redis) | The API reports "not ready" (it checks Redis too), live updates stop and the workers stop until it is back. Jobs queued and not yet saved to disk are lost. |
| **File storage** | **An S3 service that keeps copies in more than one place**: [File storage](#file-storage) | Photos and documents cannot be saved or shown. The rest of FixFlow works. |
| **Sensor broker** | One copy, restarted by Kubernetes, or a clustered broker of your own | Sensors reconnect when it is back; what they sent meanwhile is lost unless they resend. |

Two copies of the web and API servers and of the workers is the least that means anything; **three, spread over three zones**, lets a whole zone go.

## The database, Redis and file storage

### PostgreSQL

FixFlow connects to **one address** (the `DATABASE_URL`) and uses only the primary: it does not read from replicas. High availability for the database therefore means: a primary and one or more replicas, a failover that promotes a replica by itself, and **an address that always leads to the current primary**. Two ways:

- **A managed service with a standby**: Amazon RDS Multi-AZ, Google Cloud SQL high availability, Azure Database for PostgreSQL zone-redundant HA, DigitalOcean managed databases with a standby node. Use the writer endpoint it gives you. This is the least work, and the right choice unless you have a reason to run your own.
- **An operator in the cluster**: [CloudNativePG](https://cloudnative-pg.io), Crunchy, Zalando's. CloudNativePG makes a service `<cluster>-rw` that always points at the primary ([example](#reference-setup)).

Things to decide, and to read about in the product you choose:

- **Replication that is asynchronous can lose the last few transactions at a failover** (what had not reached the replica). Synchronous replication loses none, at the price of every write waiting for a replica. For a CMMS, a few seconds of lost work orders is usually acceptable; decide on purpose.
- **PostgreSQL 16 or newer.** The images use 16 and the application's `pg_dump` is newer.
- **A replica is not a backup.** A mistaken delete is copied to the replicas at once. Keep the nightly backups ([Backups](backups.md)), on storage that is not the database's.

### Redis

FixFlow's Redis holds the job queue, the live-updates channel, the cache and the rate-limit counts. It is configured with **one address** (`REDIS_URL`); it does not speak to Redis Sentinel or Cluster itself. So the address must always reach the current primary: a managed Redis with automatic failover and a primary endpoint (Amazon ElastiCache or MemoryDB with Multi-AZ, Google Memorystore standard tier, Azure Cache for Redis) does that. Choose one with **persistence** (append-only file or its equivalent), or jobs queued in the last moments before a failure are lost.

Redis is a hard dependency: while it is down, the API says "not ready", so the Ingress sends nobody to it, and people see an error page, not a half-working FixFlow. That is the same as for the database.

### File storage

An S3-compatible service that keeps copies in more than one place: Amazon S3 (or another cloud's), a replicated MinIO or Ceph you run. Make **two buckets** first (`storage.bucket` for photos and documents, `storage.backupBucket` for the nightly database backups) and give the login in `secrets.s3AccessKey` and `secrets.s3SecretKey`. Better still, keep the **backups in another storage** from the uploads (`BACKUP_S3_*`, see [Backups](backups.md)), so that losing one does not lose both.

## Reference setup

A company on a managed cloud, with all four underneath outside the cluster. The Secret has the keys `SECRET_KEY_BASE`, `DEVISE_JWT_SECRET_KEY`, `DATABASE_URL`, `REDIS_URL`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY` and `MQTT_PASSWORD` ([Secrets](kubernetes.md#secrets)); the values file:

```yaml
appUrl: https://fixflow.example.com
existingSecret: fixflow-secrets

# Nothing underneath is run by the chart
postgresql: { enabled: false }     # DATABASE_URL in the Secret: the managed database's writer endpoint
redis: { enabled: false }          # REDIS_URL in the Secret: the managed Redis's primary endpoint
s3: { enabled: false }
storage:
  endpoint: https://s3.eu-west-1.amazonaws.com
  region: eu-west-1
  bucket: acme-fixflow-uploads
  backupBucket: acme-fixflow-backups
mqtt:
  enabled: false
  external: { host: mqtt.example.com, port: 1883 }   # or enabled: true for one copy in the cluster

# Three of each, a different zone for each where there are zones
web: { replicas: 3 }
api: { replicas: 3 }
sidekiq: { replicas: 3 }
affinity:
  podAntiAffinity:
    preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 100
        podAffinityTerm:
          topologyKey: topology.kubernetes.io/zone
          labelSelector:
            matchLabels: { app.kubernetes.io/name: fixflow }
```

The chart already prefers different **nodes** for the copies of each part (`spread.enabled`) and keeps one copy of each up while a node is drained (`podDisruptionBudget.enabled`). The `affinity` above adds a preference for different **zones**.

**If you run PostgreSQL in the cluster with CloudNativePG** (an example, not part of the chart and not run by our checks): install the operator, then

```yaml
apiVersion: v1
kind: Secret
metadata: { name: fixflow-db-user, namespace: fixflow }
type: kubernetes.io/basic-auth
stringData: { username: fixflow, password: "<openssl rand -hex 24>" }
---
apiVersion: postgresql.cnpg.io/v1
kind: Cluster
metadata: { name: fixflow-db, namespace: fixflow }
spec:
  instances: 3
  storage: { size: 20Gi }
  bootstrap:
    initdb:
      database: fixflow_production
      owner: fixflow
      secret: { name: fixflow-db-user }
```

and put `postgres://fixflow:<that password>@fixflow-db-rw.fixflow.svc:5432/fixflow_production` in the Secret as `DATABASE_URL`. The operator's documentation covers synchronous replication, backups to object storage, and spreading the three instances over zones.

### Faster failover for the sensor listener

When a node is lost, Kubernetes waits (five minutes by default) before it moves that node's pods. For the one listening worker that is five minutes of lost readings. The chart's `tolerations` setting applies to all the application's pods, so shortening the wait shortens it for them all, which is what you want for the web, API and workers too:

```yaml
tolerations:
  - { key: node.kubernetes.io/unreachable, operator: Exists, effect: NoExecute, tolerationSeconds: 30 }
  - { key: node.kubernetes.io/not-ready, operator: Exists, effect: NoExecute, tolerationSeconds: 30 }
```

A short wait moves pods on a network blip too; thirty seconds is a trade, not a rule.

## Upgrades without stopping

The chart starts new API servers before it stops old ones, and never runs fewer than it is set to, so an upgrade does not stop FixFlow. Three things to know:

- **The old servers keep answering while the first new one migrates the database.** A migration that the old code cannot work with would break it for those moments. The release's **Upgrade** line in the [changelog](changelog.md) says when a release needs care; for one that does, stop FixFlow first, upgrade, and start it again, accepting the stop: scale the four Deployments (`fixflow-web`, `fixflow-api`, `fixflow-sidekiq`, `fixflow-sidekiq-iot`) to 0 with `kubectl -n fixflow scale`, run `helm upgrade`, then scale them back to the number of copies you run (Helm does not do that for you: the chart's number has not changed). The first new API server then migrates with no old one running.
- **Take a backup first**, and know the [restore](kubernetes.md#backups-and-restoring); `helm rollback` does not undo a migration.
- The one sensor listener is replaced, not added to, so there are a few seconds without one during an upgrade.

## Try it before you need it

None of the above is proven until you have watched it happen on your own install. Do these on a copy, or at a quiet time, with a page of FixFlow open and `kubectl get pods -w` beside it:

1. **Kill an API pod** (`kubectl -n fixflow delete pod <one of fixflow-api-…>`). Nobody should notice.
2. **Drain a node** (`kubectl drain <node> --ignore-daemonsets --delete-emptydir-data`). Pods move, one copy of each part stays up. The sensor listener is gone for a few seconds.
3. **Fail the database over** (a managed one: the provider's "reboot with failover"; CloudNativePG: `kubectl cnpg promote fixflow-db <a replica>`). The API reports "not ready" for a while and people see an error; time how long, then check it recovers **without** you restarting anything.
4. **Restart Redis** the same way. Check that live updates come back (an alert appearing on the Dashboard) and that jobs resume (System Health, Background jobs).
5. **Restore a backup** into a copy of the install, and sign in to it.

## What this does not give you

- **A whole region.** Everything above is within one region. Losing the region means restoring from backups kept elsewhere, into a new install: keep the backups in another region ([Backups](backups.md)), and write down the steps.
- **No lost work at a database failover**, unless you choose synchronous replication.
- **The sensor listener without a gap.** It is one process. A clustered broker keeps sensors' messages safe, but FixFlow's listener still reads them one at a time from one place.
- **A cluster that stays up.** If the cluster's own control plane or all its nodes are lost, so is FixFlow; managed Kubernetes services make that someone else's problem, which is a reason to use one.
- **Measured numbers.** The checks in CI kill one API pod and upgrade while the API answers, on a cluster of one node. Failover times for your database, Redis and nodes are yours to measure, with the list above.
