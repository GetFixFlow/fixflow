# Two separate stacks: docker-compose.yml is for development, docker-compose.prod.yml is a production install
# (README: "Install on a server"). The targets that start with prod, plus backup and restore, are the production one.
PROD = docker compose -f docker-compose.prod.yml

.PHONY: dev stop logs prod prod-stop prod-logs prod-status backup restore build-web test-web typecheck-web migrate seed demo-data console

dev:
	docker compose up --build

stop:
	docker compose down

logs:
	docker compose logs -f

prod:
	$(PROD) up --build -d

prod-stop:
	$(PROD) stop

prod-logs:
	$(PROD) logs -f

prod-status:
	$(PROD) ps

build-web:
	cd apps/web && npm run build

test-web:
	cd apps/web && npm run test

typecheck-web:
	cd apps/web && npm run typecheck

migrate:
	docker compose exec api rails db:migrate

seed:
	docker compose exec api rails db:seed

demo-data:
	docker compose exec api rails fixflow:demo_data

console:
	docker compose exec api rails console

# A gzipped dump of the production database, in this folder (git ignores it). The server also makes one every night
# (Settings, Data Retention). Restore it with: make restore FROM=backup_YYYYMMDD.sql.gz CONFIRM=yes
backup:
	$(PROD) exec -T db pg_dump -U fixflow --no-owner --no-acl fixflow_production | gzip > backup_$(shell date +%Y%m%d).sql.gz

# Replaces the WHOLE production database with a backup: the web app and the worker are stopped, the restore runs, they start again.
#   make restore FROM=latest CONFIRM=yes                                  the newest nightly backup in the file storage
#   make restore FROM=fixflow_20261018_030000.sql.gz CONFIRM=yes          a named one from the file storage
#   make restore FROM=backup_20261018.sql.gz CONFIRM=yes                  a file in this folder (from `make backup`, or downloaded)
# The restore is one transaction: if it fails, the database is exactly as it was.
restore:
	@test -n "$(FROM)" || { echo "Say what to restore: make restore FROM=latest|<backup name>|<file> CONFIRM=yes" >&2; exit 1; }
	@test "$(CONFIRM)" = "yes" || { echo "This replaces everything in the production database with $(FROM). Run it again with CONFIRM=yes to go ahead." >&2; exit 1; }
	$(PROD) stop web sidekiq api
	@if [ -f "$(FROM)" ]; then \
	  $(PROD) run --rm -T -e REPLACE=yes -v "$(abspath $(FROM)):/tmp/restore.sql.gz:ro" api bin/rails "fixflow:restore[/tmp/restore.sql.gz]"; \
	else \
	  $(PROD) run --rm -T -e REPLACE=yes api bin/rails "fixflow:restore[$(FROM)]"; \
	fi
	$(PROD) up -d
