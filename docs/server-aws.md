# On AWS

A FixFlow server on an Amazon EC2 instance, with a name and HTTPS, and backups in an S3 bucket. It uses the [one-command install](install.md#one-command-install); this page is the steps around it.

!!! note "Not walked through on a live account"
    The install script was run in a fresh Ubuntu 24.04 system, but these steps were written from AWS's documentation and not followed click by click on a real account. The order of the steps is what matters; the names of console pages may differ. If something does not match, please [open an issue](https://github.com/GetFixFlow/fixflow/issues).

## You need

- An AWS account, and a **domain name** you can add a record to (Route 53 or anywhere else).
- Knowing which **region** you want (near the people who use it).

## 1. Launch the instance

- **Image:** *Ubuntu Server 24.04 LTS*, 64-bit (x86 or Arm).
- **Type:** at least **2 GB of memory** (`t3.small` or similar) for the [lite install](lite.md); `t3.medium` (4 GB) for the full one, which has not been measured on 2 GB.
- **Key pair:** make or choose one; you sign in with it.
- **Storage:** 20 GB or more of general-purpose SSD (gp3). The database, the uploaded files and, on the lite install, the backups share it.
- **Security group** (the firewall) inbound rules:

| Port | From | Why |
| --- | --- | --- |
| 22 (SSH) | your own address only | administering the server |
| 80 and 443 | anywhere | the web app, and the certificate being issued |

## 2. Give it a fixed address and a name

An instance's public address changes when it is stopped and started. Allocate an **Elastic IP** and associate it with the instance, then add an **A record** for your name (for example `fixflow.example.com`) pointing at it. Check from your computer:

```bash
dig +short fixflow.example.com      # should print the Elastic IP
```

The certificate cannot be issued until this is true.

## 3. Install

```bash
ssh -i your-key.pem ubuntu@<the Elastic IP>
curl -fsSLO https://raw.githubusercontent.com/GetFixFlow/fixflow/main/deploy/install.sh
less install.sh                      # read what it will do
sudo sh install.sh --domain fixflow.example.com --email you@example.com --lite
```

Leave out `--lite` for the full install. On AWS the public address is not on the machine itself, so the script's note about which addresses the server has will show the private one: that is normal as long as the name resolves to your Elastic IP. The script installs Docker, downloads FixFlow into `/opt/fixflow`, writes `.env` with random secrets, builds and starts it (5 to 10 minutes) and prints the address. Open `https://fixflow.example.com`: the first page creates your company and the first administrator.

## 4. Set up backups before you rely on it

Until you do, backups are on the instance's own disk and are lost with it.

1. Make an **S3 bucket** (private, in the region you like, with versioning on if you want deleted backups to be recoverable).
2. Make an **IAM user** with only this permission, and an access key for it (FixFlow needs a key; it does not use an instance role):

    ```json
    {
      "Version": "2012-10-17",
      "Statement": [
        { "Effect": "Allow", "Action": "s3:ListBucket", "Resource": "arn:aws:s3:::YOUR-BUCKET" },
        { "Effect": "Allow", "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"], "Resource": "arn:aws:s3:::YOUR-BUCKET/*" }
      ]
    }
    ```

3. Add to `/opt/fixflow/.env`:

    ```bash
    BACKUP_S3_ACCESS_KEY=...
    BACKUP_S3_SECRET_KEY=...
    BACKUP_S3_BUCKET=YOUR-BUCKET
    BACKUP_S3_REGION=eu-central-1          # the bucket's region
    BACKUP_S3_PATH_STYLE=false             # Amazon S3 (leave BACKUP_S3_ENDPOINT out)
    ```

4. `cd /opt/fixflow && make prod`, then check **Settings, Data Retention**: it lists a backup after the first night (or run `bin/compose exec api bin/rails fixflow:backup` to make one now). Details and the restore are in [Backups and restoring](backups.md).

Also copy `/opt/fixflow/.env` somewhere safe away from the instance: a backup cannot be read back without it.

## Afterwards

- Email and branding are set in the app (**Settings**): [Configuration](configuration.md).
- New versions: `cd /opt/fixflow && make upgrade TO=v0.2.0` ([Upgrading and rolling back](upgrading.md)).
- Keep Ubuntu itself updated (`sudo apt-get update && sudo apt-get upgrade`); Docker starts by itself at boot and so does FixFlow.
- Something wrong: [Troubleshooting](troubleshooting.md).
