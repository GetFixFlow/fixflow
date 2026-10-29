# HTTPS

Serve FixFlow over HTTPS: a free certificate, your own, or an internal one.

Without HTTPS, sign-in tokens and passwords cross your network readable, and browsers refuse the phone camera (QR scanning) and the offline cache on any address that is not HTTPS (`localhost` counts as secure). The Docker install can serve HTTPS itself: a small web server (Caddy) in front of the front door, started by one line in `.env`. Pick the case that is yours.

| Your server is... | Use | You need |
|---|---|---|
| On the internet, with a name (`fixflow.example.com`) | `HTTPS_MODE=automatic` | The name pointing at the server, ports 80 and 443 open to the internet. The certificate is free (Let's Encrypt) and renews by itself. |
| On a company network, and IT gave you a certificate | `HTTPS_MODE=own-certificate` | The certificate and its key as `certs/fixflow.crt` and `certs/fixflow.key` |
| On a company network with no certificate to use | `HTTPS_MODE=internal` | To install FixFlow's own root certificate on every computer and phone (below) |
| Behind your company's proxy or load balancer, which already does HTTPS | Leave this off | `APP_URL=https://...`, and the proxy must send `X-Forwarded-Proto: https` and pass WebSocket upgrades on `/cable` |

In `.env` (the lines are in `.env.example`, commented out), for example:

```
APP_URL=https://fixflow.example.com
COMPOSE_PROFILES=https
HTTPS_DOMAIN=fixflow.example.com
HTTPS_MODE=automatic
HTTPS_EMAIL=it@example.com
HTTP_PORT=8080
HTTP_BIND=127.0.0.1
```

`HTTP_PORT` and `HTTP_BIND` move the plain-HTTP door out of the way (the HTTPS service takes ports 80 and 443) and close it to the network; the server refuses to start with the old values, and says so. Then `make prod` (or the `docker compose ... up -d --build` of the install) adds the `https` service, and `docker compose -f docker-compose.prod.yml logs https` shows it getting the certificate, which takes seconds. Plain HTTP on port 80 is sent on to HTTPS. Sign in again at the new address: browsers keep the sign-in per address.

- **own-certificate**: put the certificate (followed by any intermediate certificates your IT gives) in `certs/fixflow.crt` and the key in `certs/fixflow.key`, next to `docker-compose.prod.yml`. Git and the images never get the `certs` folder. When the certificate is renewed, replace the files and run `docker compose -f docker-compose.prod.yml restart https`.
- **internal**: Caddy makes its own certificate authority and signs the certificate. Every browser and phone shows a warning until it trusts that authority. Get the root certificate with `docker compose -f docker-compose.prod.yml cp https:/data/caddy/pki/authorities/local/root.crt fixflow-root.crt` and install it on each device as a trusted root (the steps differ for Windows, macOS, Android and iOS; your IT department has them). Without that, the camera and the offline cache will not work on phones either.
- **automatic**: Let's Encrypt must be able to reach the server on port 80 under that name, from the internet. If the certificate does not come, `logs https` says why (the usual reasons: the name does not point at this server yet, or a firewall in front of port 80 or 443). Certificates are kept in the `caddy_data` volume; do not delete it often, because Let's Encrypt limits how many it issues for a name.
- Certificates are not part of the backups: a new server gets a new one (automatic) or needs your files again (own-certificate).

`bin/check_https` is the test of this: CI runs it on every change. It starts the stack with a certificate it makes, checks that exactly that certificate is served, that the web app, the API and a WebSocket work over HTTPS, that plain HTTP is redirected and the plain-HTTP door is closed to the network, then switches to `internal` and checks Caddy's authority signs. It cannot get a Let's Encrypt certificate (that needs a real name on the internet), so `automatic` for a real domain is the one mode CI has not seen.
