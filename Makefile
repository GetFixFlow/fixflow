.PHONY: dev prod stop logs build-web test-web migrate seed console backup

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

migrate:
	docker compose exec api rails db:migrate

seed:
	docker compose exec api rails db:seed

console:
	docker compose exec api rails console

backup:
	docker compose exec db pg_dump -U postgres fixflow_production > backup_$(shell date +%Y%m%d).sql
