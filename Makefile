.PHONY: help install setup up down api db-reset db-seed test test-heavy test-functional test-contract test-security test-perf lint typecheck clean

# Day-to-day targets. `make test` runs the Vitest suite. Slow suites
# (Postman via Newman, k6 load, mutation testing) are deliberately kept out
# of it so they do not penalize anyone who just wants fast feedback. Look at
# test-heavy if you want to run everything at once before opening a large PR.

help:
	@echo "Make targets:"
	@echo "  install         npm ci"
	@echo "  setup           install + prisma generate + migrate deploy + seed"
	@echo "  up              docker compose up (api, wiremock, pact-broker)"
	@echo "  down            docker compose down -v"
	@echo "  api             API in watch mode"
	@echo "  db-reset        reset the database"
	@echo "  db-seed         load seeds"
	@echo "  test            main Vitest suite"
	@echo "  test-functional vitest tests/functional"
	@echo "  test-contract   pact consumer + provider"
	@echo "  test-security   vitest tests/security"
	@echo "  test-perf       k6 smoke (needs local k6)"
	@echo "  test-heavy      test + k6 smoke + Newman (slow, optional)"
	@echo "  lint            eslint --max-warnings 0"
	@echo "  typecheck       tsc --noEmit"
	@echo "  clean           remove artifacts"
	@echo ""
	@echo "Extra npm scripts NOT part of test:"
	@echo "  npm run test:mutation     Stryker, tens of minutes"
	@echo "  npm run test:perf:load    k6 load (needs the API running)"
	@echo "  npm run test:postman      Newman (needs the API running)"
	@echo "  npm run test:coverage     vitest with @vitest/coverage-v8"

install:
	npm ci

setup: install
	npm run db:generate
	npm run db:migrate
	npm run db:seed

up:
	docker compose -f docker/docker-compose.yml up -d --build

down:
	docker compose -f docker/docker-compose.yml down -v

api:
	npm run api:dev

db-reset:
	npm run db:reset

db-seed:
	npm run db:seed

test:
	npm test

# test-heavy assumes the API is running at http://localhost:3000 for Newman.
test-heavy: test test-perf
	npm run test:postman

test-functional:
	npm run test:functional

test-contract:
	npm run test:pact:consumer
	npm run test:pact:provider

test-security:
	npm run test:security

test-perf:
	npm run test:perf:smoke

lint:
	npm run lint

typecheck:
	npm run typecheck

clean:
	rm -rf dist coverage pacts reports .vitest-cache
