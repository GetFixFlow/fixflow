.PHONY: dev prod stop logs build-web test-web typecheck-web migrate seed demo-data console backup

dev:
	docker compose up --build

prod:
	docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d

stop:
	docker compose down

logs:
	docker compose logs -f

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

# A gzipped dump of the production database, in this folder. The server also makes one every night (Settings, Data Retention).
# Restore it with: rails "fixflow:restore[backup_YYYYMMDD.sql.gz]" (see "Backups" in the README).
backup:
	docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T db pg_dump -U fixflow --no-owner --no-acl fixflow_production | gzip > backup_$(shell date +%Y%m%d).sql.gz
