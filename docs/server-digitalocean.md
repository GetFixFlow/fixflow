# On DigitalOcean

A FixFlow server on a DigitalOcean Droplet, with a name and HTTPS, in about 20 minutes plus the first build. It uses the [one-command install](install.md#one-command-install); this page is the steps around it.

!!! note "Not walked through on a live account"
    The install script was run in a fresh Ubuntu 24.04 system, but these steps were written from DigitalOcean's documentation and not followed click by click on a real Droplet. Where a button is named it may have moved: the order of the steps is what matters. If something does not match, please [open an issue](https://github.com/GetFixFlow/fixflow/issues).

## You need

- A DigitalOcean account and a **domain name** you can add a record to (at DigitalOcean's DNS or anywhere else). Without a name, use the install without `--domain` and plain HTTP, or see [HTTPS](https.md).
- An SSH key on your computer (`ssh-keygen -t ed25519` makes one).

## 1. Create the Droplet

- **Image:** Ubuntu 24.04 (LTS), 64-bit.
- **Size:** at least **2 GB of memory**. That fits the [lite install](lite.md); for the full install (which adds a file-storage server and a sensor broker) take **4 GB** to have room, as the full install has not been measured on a 2 GB server.
- **Authentication:** your SSH key. Do not use a password.
- **Region:** near the people who use it.

DigitalOcean's own Droplet backups copy the whole disk weekly; they are a safety net, **not a replacement** for FixFlow's backups below.

## 2. Open only what is needed

Create a **Cloud Firewall** for the Droplet that allows inbound:

| Port | From | Why |
| --- | --- | --- |
| 22 (SSH) | your own address only, if it is fixed | signing in to administer the server |
| 80 and 443 | everywhere | the web app, and the certificate being issued |

Everything else stays closed. (Sensors that speak MQTT on the full install also need port 1883, from the sensors' addresses only.)

## 3. Point the name at it

Add an **A record** for the name you want (for example `fixflow.example.com`) with the Droplet's IPv4 address. Check from your computer that it has taken effect, which can take a few minutes:

```bash
dig +short fixflow.example.com      # should print the Droplet's address
```

The certificate cannot be issued until this is true.

## 4. Install

```bash
ssh root@<the Droplet's address>
curl -fsSLO https://raw.githubusercontent.com/GetFixFlow/fixflow/main/deploy/install.sh
less install.sh                      # read what it will do
sh install.sh --domain fixflow.example.com --email you@example.com --lite
```

Leave out `--lite` for the full install. The script installs Docker, downloads FixFlow into `/opt/fixflow`, writes `.env` with random secrets, builds and starts it (5 to 10 minutes) and prints the address. Open `https://fixflow.example.com`: the first page creates your company and the first administrator.

## 5. Set up backups before you rely on it

Until you do, backups are on the Droplet's own disk and are lost with it. DigitalOcean **Spaces** speaks the S3 protocol: make a Space, make an access key for it, and add to `/opt/fixflow/.env`:

```bash
BACKUP_S3_ENDPOINT=https://<region>.digitaloceanspaces.com    # shown in the Space's settings
BACKUP_S3_ACCESS_KEY=...
BACKUP_S3_SECRET_KEY=...
BACKUP_S3_BUCKET=<the Space's name>
BACKUP_S3_REGION=<the region, such as fra1>
```

Then `cd /opt/fixflow && make prod` and check **Settings, Data Retention**: it should list a backup after the first night (or run `bin/compose exec api bin/rails fixflow:backup` to make one now). Details and the restore are in [Backups and restoring](backups.md). Also copy `/opt/fixflow/.env` somewhere safe away from the Droplet: a backup cannot be read back without it.

## Afterwards

- Email and branding are set in the app (**Settings**): [Configuration](configuration.md).
- New versions: `cd /opt/fixflow && make upgrade TO=v0.2.0` ([Upgrading and rolling back](upgrading.md)).
- Keep Ubuntu itself updated (`apt-get update && apt-get upgrade`, then a reboot when it asks); Docker starts by itself at boot and so does FixFlow.
- Something wrong: [Troubleshooting](troubleshooting.md).
