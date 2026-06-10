# Postman collection + Newman

Smoke + happy path of the reference API in Postman v2.1.0 format. The collection runs in a deliberate order: login captures the token, the user/order creation captures the id, and the following operations use those variables. We keep the tests pragmatic (status, basic schema, state transition contracts) instead of duplicating everything already covered by the `*.spec.ts` files.

## Run in Postman GUI

Import `postman/collection.json` and `postman/environment.json`. Pick the "Local" environment in the top-right corner. Use the Runner to execute the whole collection in the order the folders appear: Health, Auth, Users, Orders. Without running Auth first, the authenticated requests fail with 401 (the `token` is empty in the environment).

## Run via Newman

Prerequisite: local API up with the seed applied (`npm run db:seed`).

```bash
npm run test:postman
```

The script is equivalent to `newman run postman/collection.json -e postman/environment.json`. To point at staging:

```bash
newman run postman/collection.json \
  -e postman/environment.json \
  --env-var "baseUrl=https://staging.example.com"
```

## HTML report

The `htmlextra` reporter produces a rich HTML report, useful to attach to a PR or share with product:

```bash
npm i -D newman-reporter-htmlextra
newman run postman/collection.json \
  -e postman/environment.json \
  -r cli,htmlextra \
  --reporter-htmlextra-export reports/postman.html
```

The file at `reports/postman.html` groups by folder, shows passing/failing assertions, and includes the body of each response. In CI it is worth uploading as a job artifact.

## Environment variables

- `baseUrl`: HTTP target. Default `http://localhost:3000`.
- `adminEmail` / `adminPassword`: seed credentials. Marked as `secret` so they do not leak in logs.
- `token`: filled by the login test. Overwritten on every run.
- `userId`: filled by the POST /users creation, consumed by the DELETE.
- `orderId`: starts with the seeded id (`10000000-...01`) to allow running the PATCH even if the POST orders fails. The POST overwrites with the new id.

To customize without touching the versioned file, copy it to `postman/environment.local.json` and use `-e` pointing at that copy. `.gitignore` should cover `*.local.json`.
