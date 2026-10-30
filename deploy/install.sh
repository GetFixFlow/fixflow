#!/bin/sh
# Sets up FixFlow on a fresh Ubuntu or Debian server with one command:
#
#   curl -fsSLO https://raw.githubusercontent.com/GetFixFlow/fixflow/main/deploy/install.sh
#   sudo sh install.sh --domain fixflow.example.com --email it@example.com
#
# (Read it before you run it: it installs Docker, downloads FixFlow into /opt/fixflow and starts it.)
#
# What it does, in order, and tells you as it goes:
#   1. checks the system (Ubuntu 22.04+ or Debian 12+, run as root) and that ports 80 and 443 are free
#   2. installs git, make, openssl and Docker with Compose, from Docker's own apt repository, unless they are there
#   3. downloads FixFlow into --dir (the newest release, or --version) with git
#   4. writes .env: every secret made here with openssl, nothing else asked; the file is readable by root only
#   5. builds and starts it (5 to 10 minutes the first time) and waits until every service is healthy
#   6. prints the address to open, and what to do next
#
# It never overwrites an existing install or .env. To change an install afterwards, edit .env and run `make prod`.
#
# Options:
#   --domain NAME     the name people open FixFlow at (fixflow.example.com). Turns on HTTPS with a free certificate from
#                     Let's Encrypt: the name must already point at this server and ports 80 and 443 must reach it.
#   --email ADDRESS   with --domain: where Let's Encrypt writes before a certificate runs out
#   --url ADDRESS     no domain: the address people open FixFlow at, such as http://fixflow.company.local or
#                     http://10.0.0.5:8080 (plain HTTP; see docs/https.md for your own certificate). Without --domain and
#                     --url it is http://<this server's first address>.
#   --lite            the lite install (five services, no file-storage server or sensor broker; docs/lite.md)
#   --version TAG     a release to install, such as v0.2.0 (default: the newest release, or main if there is none yet)
#   --dir PATH        where to put it (default /opt/fixflow)
#   --no-start        do everything but build and start it
#   --env-only        only write .env, inside --dir, which must already be a FixFlow checkout (no packages, no root,
#                     nothing started); what the tests and anyone installing by hand use
#   --help            this text
set -eu

REPO="https://github.com/GetFixFlow/fixflow.git"
DIR="/opt/fixflow"
DOMAIN=""
EMAIL=""
URL=""
LITE=no
WANTED=""
START=yes
ENV_ONLY=no

say() { printf '%s\n' "$*"; }
step() { printf '\n==> %s\n' "$*"; }
warn() { printf 'warning: %s\n' "$*" >&2; }
die() { printf 'install.sh: %s\n' "$*" >&2; exit 1; }

usage() { sed -n '2,/^set -eu/p' "$0" | sed '$d' | sed 's/^# \{0,1\}//'; }

parse_args() {
  while [ $# -gt 0 ]; do
    case "$1" in
      --domain) [ $# -ge 2 ] || die "--domain needs a name"; DOMAIN=$2; shift 2 ;;
      --email) [ $# -ge 2 ] || die "--email needs an address"; EMAIL=$2; shift 2 ;;
      --url) [ $# -ge 2 ] || die "--url needs an address"; URL=$2; shift 2 ;;
      --lite) LITE=yes; shift ;;
      --version) [ $# -ge 2 ] || die "--version needs a release such as v0.2.0"; WANTED=$2; shift 2 ;;
      --dir) [ $# -ge 2 ] || die "--dir needs a folder"; DIR=$2; shift 2 ;;
      --no-start) START=no; shift ;;
      --env-only) ENV_ONLY=yes; shift ;;
      -h|--help) usage; exit 0 ;;
      *) die "I do not know $1 (see --help)" ;;
    esac
  done
  [ -z "$DOMAIN" ] || [ -z "$URL" ] || die "Use --domain (HTTPS, a free certificate) or --url (an address of your own), not both."
  [ -z "$EMAIL" ] || [ -n "$DOMAIN" ] || die "--email is for --domain: it is where Let's Encrypt writes."
  if [ -n "$DOMAIN" ]; then
    printf '%s' "$DOMAIN" | grep -Eq '^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$' ||
      die "--domain is a name only, like fixflow.example.com: no https:// in front, no port or path after."
  fi
  if [ -n "$URL" ]; then
    printf '%s' "$URL" | grep -Eq '^https?://[^/[:space:]]+$' ||
      die "--url looks like http://fixflow.company.local or http://10.0.0.5:8080 (no slash at the end)."
  fi
  [ -z "$WANTED" ] || printf '%s' "$WANTED" | grep -Eq '^v[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.]+)?$' ||
    die "--version looks like v0.2.0."
}

check_system() {
  [ "$(id -u)" = "0" ] || die "Run this as root: sudo sh install.sh ..."
  [ -r /etc/os-release ] || die "This is not a system I know (no /etc/os-release). Install Docker yourself and follow docs/install.md."
  # Read in a subshell: the file sets VERSION, NAME, URLs... and must not overwrite this script's own variables.
  # shellcheck disable=SC1091
  os=$(. /etc/os-release; printf '%s|%s|%s|%s' "${ID:-}" "${VERSION_ID:-0}" "${UBUNTU_CODENAME:-${VERSION_CODENAME:-}}" "${PRETTY_NAME:-}")
  OS_ID=${os%%|*}; rest=${os#*|}
  OS_VERSION=${rest%%|*}; rest=${rest#*|}
  OS_CODENAME=${rest%%|*}; OS_NAME=${rest#*|}
  case "$OS_ID" in
    ubuntu) major=${OS_VERSION%%.*}; [ "${major:-0}" -ge 22 ] || warn "Ubuntu $OS_VERSION is older than the 22.04 this was written for; it may not work." ;;
    debian) [ "${OS_VERSION%%.*}" -ge 12 ] 2>/dev/null || warn "Debian $OS_VERSION is older than the 12 this was written for; it may not work." ;;
    *) die "This installs on Ubuntu or Debian, and this is ${OS_NAME:-${OS_ID:-unknown}}. Install Docker with Compose yourself and follow docs/install.md." ;;
  esac
  case "$(uname -m)" in x86_64|aarch64|arm64) ;; *) warn "The processor $(uname -m) is not one the images were tried on." ;; esac
  command -v apt-get >/dev/null 2>&1 || die "apt-get is missing, so I cannot install the packages."
}

# A port something else already listens on would make the web server fail to start, minutes in, with an unclear message.
check_ports() {
  command -v ss >/dev/null 2>&1 || return 0
  for port in $(wanted_ports); do
    if ss -ltn 2>/dev/null | awk '{print $4}' | grep -Eq "[:.]${port}$"; then
      die "Something is already listening on port $port. Stop it (or use --url with another port), then run this again."
    fi
  done
}

wanted_ports() {
  if [ -n "$DOMAIN" ]; then echo "80 443"; return; fi
  port=$(url_port "$(app_url)")
  echo "${port:-80}"
}

url_port() { printf '%s' "$1" | sed -n 's|^https\{0,1\}://[^/:]*:\([0-9][0-9]*\)$|\1|p'; }

app_url() {
  if [ -n "$DOMAIN" ]; then echo "https://$DOMAIN"
  elif [ -n "$URL" ]; then echo "$URL"
  else echo "http://$(first_address)"
  fi
}

first_address() {
  address=$(hostname -I 2>/dev/null | awk '{print $1}')
  echo "${address:-localhost}"
}

install_packages() {
  step "Installing git, make, openssl and curl"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq ca-certificates curl git make openssl gnupg >/dev/null
}

install_docker() {
  if docker compose version >/dev/null 2>&1; then
    step "Docker with Compose is already installed ($(docker --version))"
    return
  fi
  step "Installing Docker from Docker's own apt repository"
  [ -n "$OS_CODENAME" ] || die "I cannot tell which release of $OS_ID this is (no codename in /etc/os-release)."
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL "https://download.docker.com/linux/$OS_ID/gpg" -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/$OS_ID $OS_CODENAME stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin >/dev/null
  # Start now and at every boot (a container image or a machine without systemd has no service to start).
  if [ -d /run/systemd/system ]; then systemctl enable --now docker >/dev/null 2>&1 || warn "Could not enable the docker service."; fi
  docker compose version >/dev/null 2>&1 || die "Docker was installed but 'docker compose' does not work."
}

# The newest release that is not a candidate, else nothing.
latest_release() {
  git ls-remote --tags --refs "$REPO" 'v[0-9]*' 2>/dev/null | awk '{sub("refs/tags/", "", $2); print $2}' |
    grep -Ev -- '-' | sort -V | tail -n 1
}

download() {
  step "Downloading FixFlow into $DIR"
  if [ -e "$DIR/.git" ] || [ -e "$DIR/.env" ]; then
    die "$DIR is already a FixFlow install. To move it to a new version: cd $DIR && make upgrade TO=v0.2.0 (docs/upgrading.md)."
  fi
  [ ! -e "$DIR" ] || [ -z "$(ls -A "$DIR")" ] || die "$DIR exists and is not empty. Use --dir for another folder."
  ref=$WANTED
  if [ -z "$ref" ]; then
    ref=$(latest_release)
    if [ -z "$ref" ]; then
      ref=main
      warn "FixFlow has no release yet, so this installs the development version (main). Use --version when there is one."
    fi
  fi
  git clone -q "$REPO" "$DIR"
  git -C "$DIR" -c advice.detachedHead=false checkout -q "$ref" || die "There is no version $ref. The releases are at ${REPO%.git}/releases."
  say "Version: $ref"
}

secret() { openssl rand -hex "$1"; }

# .env is .env.example plus the lines below it. In an env file the last line for a setting wins, so nothing in
# .env.example has to be edited, and what this script decided is easy to see at the bottom.
write_env() {
  cd "$DIR"
  [ -f .env.example ] || die "$DIR is not a FixFlow checkout (no .env.example)."
  [ ! -e .env ] || die "$DIR/.env already exists. I do not overwrite it."
  step "Writing $DIR/.env"
  previous_umask=$(umask)
  umask 077
  cp .env.example .env
  if [ "$LITE" = yes ]; then
    # The lite install has no file-storage server or sensor broker; their lines are not used.
    grep -Ev '^(MINIO|MQTT)_' .env > .env.part && mv .env.part .env
  fi
  url=$(app_url)
  {
    echo
    echo "# ── Written by deploy/install.sh on $(date -u +%Y-%m-%d). Keep a copy of this file somewhere safe: without it a backup cannot be used. ──"
    [ "$LITE" = yes ] && echo "COMPOSE_FILE=docker-compose.lite.yml"
    echo "APP_URL=$url"
    echo "SECRET_KEY_BASE=$(secret 64)"
    echo "DEVISE_JWT_SECRET_KEY=$(secret 48)"
    echo "DB_PASSWORD=$(secret 24)"
    echo "REDIS_PASSWORD=$(secret 24)"
    if [ "$LITE" != yes ]; then
      echo "MINIO_ACCESS_KEY=$(secret 10)"
      echo "MINIO_SECRET_KEY=$(secret 24)"
      echo "MQTT_PASSWORD=$(secret 24)"
    fi
    if [ -n "$DOMAIN" ]; then
      # The HTTPS front door takes ports 80 and 443; the plain-HTTP door moves to 8080 and is closed to the network.
      echo "COMPOSE_PROFILES=https"
      echo "HTTPS_DOMAIN=$DOMAIN"
      echo "HTTPS_MODE=automatic"
      [ -z "$EMAIL" ] || echo "HTTPS_EMAIL=$EMAIL"
      echo "HTTP_PORT=8080"
      echo "HTTP_BIND=127.0.0.1"
    else
      port=$(url_port "$url")
      [ -z "$port" ] || echo "HTTP_PORT=$port"
    fi
  } >> .env
  chmod 600 .env
  umask "$previous_umask"
  say "Done. The secrets are random and are not shown; they are in the file."
}

firewall_note() {
  command -v ufw >/dev/null 2>&1 || return 0
  ufw status 2>/dev/null | grep -q '^Status: active' || return 0
  warn "The firewall (ufw) is on. Let people in with: ufw allow 80/tcp && ufw allow 443/tcp"
}

dns_note() {
  [ -n "$DOMAIN" ] || return 0
  resolved=$(getent hosts "$DOMAIN" 2>/dev/null | awk '{print $1}' | head -n 1)
  if [ -z "$resolved" ]; then
    warn "$DOMAIN does not resolve to any address yet. Make its DNS record point at this server first, or the certificate cannot be issued."
  else
    say "$DOMAIN resolves to $resolved. This server's addresses: $(hostname -I 2>/dev/null | tr -s ' ' | sed 's/ $//')"
    say "If $resolved is not one of them, the certificate will not be issued until the record points here (behind a cloud provider's public address that is normal: the address is not on the machine)."
  fi
}

start_stack() {
  cd "$DIR"
  step "Building and starting FixFlow (the first time takes 5 to 10 minutes)"
  if ! bin/compose up -d --build --wait --wait-timeout 900; then
    bin/compose ps >&2 || true
    die "FixFlow did not come up healthy. Look at the log: cd $DIR && bin/compose logs --tail 100   (docs/troubleshooting.md)"
  fi
}

finish() {
  url=$(app_url)
  step "FixFlow is running"
  say "Open $url"
  say "The first page asks for your company's name and the first administrator. After that, public sign-up is closed."
  say ""
  say "Next:"
  say "  1. Set where the backups go BEFORE you rely on this server (they are on this same disk until you do):"
  say "     $DIR/docs/backups.md"
  say "  2. Keep a copy of $DIR/.env somewhere safe, away from this server."
  say "  3. Email and branding are set in the app (Settings). Sign-in is plain HTTP unless you used --domain."
  say "  4. To move to a new version later: cd $DIR && make upgrade TO=v0.2.0"
  say "  5. Something wrong? cd $DIR && bin/compose ps   and   make prod-logs   (docs/troubleshooting.md)"
}

main() {
  parse_args "$@"
  if [ "$ENV_ONLY" = yes ]; then
    write_env
    return 0
  fi
  check_system
  check_ports
  install_packages
  install_docker
  download
  write_env
  firewall_note
  dns_note
  if [ "$START" = yes ]; then
    start_stack
    finish
  else
    say ""
    say "Everything is ready but not started. Start it with: cd $DIR && make prod"
  fi
}

main "$@"
