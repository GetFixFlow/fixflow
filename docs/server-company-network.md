# On your company's network

A FixFlow server inside the company network, reached by name from computers and phones on it, with HTTPS from your IT department's certificate or from FixFlow's own authority. It uses the [one-command install](install.md#one-command-install); this page is the steps around it.

!!! note "Not walked through on a real company network"
    The install script was run in a fresh Ubuntu 24.04 system, but every network is different and this was not tried on one with a proxy, a firewall or an internal certificate authority. If something does not match, please [open an issue](https://github.com/GetFixFlow/fixflow/issues).

## You need from IT

- A **server** (a virtual machine is fine) with **Ubuntu 24.04 or Debian 12**, at least **2 GB of memory** and 20 GB of disk, with a **fixed address**. The [lite install](lite.md) fits 2 GB.
- An **internal DNS name** for it, such as `fixflow.company.local`, pointing at that address.
- **Internet access for the install and for upgrades**: it downloads packages, Docker, FixFlow's code and the images' building blocks. A server with no internet at all is not covered yet (published images, roadmap item d04, would remove most of it). After install, FixFlow itself needs none: set `FIXFLOW_UPDATE_CHECK=false` in `.env` to stop System Health asking GitHub for new versions.
- Ports **80 and 443** open from the computers and phones that will use it to the server. Phones on guest Wi-Fi will not reach it unless that network is allowed to.
- For sensors that speak MQTT (full install only): port 1883 from the sensors' network.

## Choose how people reach it

| You have... | Install with | Notes |
| --- | --- | --- |
| A certificate for the name from your IT (or its internal certificate authority) | `--domain fixflow.company.local --https-mode own-certificate` | Best: every device already trusts it. |
| Nothing, and you accept installing a certificate on each device | `--domain fixflow.company.local --https-mode internal` | FixFlow makes its own authority; every browser and phone shows a warning until it trusts it. Phone cameras (QR scanning) and the offline cache need that trust. See [HTTPS](https.md). |
| A company proxy or load balancer that already does HTTPS | `--url https://fixflow.company.local` | The proxy must send `X-Forwarded-Proto: https` and pass WebSocket upgrades on `/cable`. FixFlow itself then speaks plain HTTP to the proxy. |
| Nothing, and no HTTPS at all (not recommended) | `--url http://fixflow.company.local` | Passwords and sign-in tokens cross the network readable; phone cameras and the offline cache do not work. |

## Install

```bash
ssh <you>@<the server>
curl -fsSLO https://raw.githubusercontent.com/GetFixFlow/fixflow/main/deploy/install.sh
less install.sh                      # read what it will do
sudo sh install.sh --domain fixflow.company.local --https-mode own-certificate --lite
```

With `own-certificate` the script writes everything and then **waits for your certificate** instead of starting: put the certificate (followed by any intermediate certificates) in `/opt/fixflow/certs/fixflow.crt` and its key in `/opt/fixflow/certs/fixflow.key`, then `cd /opt/fixflow && make prod`. With `internal` it starts at once; get the root certificate to install on devices as [HTTPS](https.md) describes.

Leave out `--lite` for the full install. When it prints the address, open it: the first page creates your company and the first administrator.

## Backups

Backups are on the server's own disk until you say otherwise: **point them at another machine** before you rely on the install. Any S3-compatible storage works, including a MinIO or SeaweedFS on another server of yours: set the `BACKUP_S3_*` settings in `/opt/fixflow/.env` ([Backups and restoring](backups.md)), `make prod`, and check **Settings, Data Retention** lists a backup the next morning. Or copy the backup volume off the server on a schedule yourself. Also keep a copy of `/opt/fixflow/.env` elsewhere: a backup cannot be read back without it.

## Afterwards

- Email: your mail server's address and whether it needs a login are set under **Settings, Email**, with a button that sends a test message ([Configuration](configuration.md#email)).
- New versions: `cd /opt/fixflow && make upgrade TO=v0.2.0` ([Upgrading and rolling back](upgrading.md)).
- Keep the operating system updated by your usual process; Docker starts by itself at boot and so does FixFlow.
- Something wrong: [Troubleshooting](troubleshooting.md).
