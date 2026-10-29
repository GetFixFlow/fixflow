# API

FixFlow's web app is a client of this API, so everything a person can do on screen can be done by a program. This page is how to sign in, what answers look like and what the limits are. Every endpoint is listed in [API endpoints](api-endpoints.md).

All endpoints are under `/api/v1/` and speak JSON: send `Content-Type: application/json` and a JSON body. Examples use `curl` against `https://fixflow.example.com`; replace it with your `APP_URL`.

!!! note "The API is not yet stable"
    FixFlow is before version 1.0. Endpoints and answers may change between minor versions; the [changelog](changelog.md) says when they do. A stable API with an upgrade promise is planned for 1.0.

## Signing in

```bash
curl -i -X POST https://fixflow.example.com/api/v1/auth/sign_in \
  -H 'Content-Type: application/json' \
  -d '{"user":{"email":"admin@example.com","password":"Blue-Ladder-4721-Kite"}}'
```

The answer is `{"message": "Logged in successfully", "user": {...}}`, and **the token is in the `Authorization` response header** (`Bearer eyJ...`), not in the body. Send it back on every request:

```bash
curl https://fixflow.example.com/api/v1/work_orders -H 'Authorization: Bearer eyJ...'
```

- A token is one **session** (see [Sign-in and security](security.md)); it lasts 24 hours. `DELETE /api/v1/auth/sign_out` ends it, and so does changing the password or deactivating the account.
- A person with [two-factor sign-in](security.md#two-factor-sign-in) gets `{"two_factor_required": true, "challenge": "..."}` and no token. Send the challenge (good for 5 minutes) and a code to `POST /api/v1/auth/two_factor` as `{"challenge": "...", "code": "123456"}`; the token then comes in the header as above.
- A wrong password counts toward the [account lock](security.md#passwords-and-locked-accounts).
- Everything you can reach is **your company's**: a token sees only the data of the company it belongs to, and the person's role decides what it may do (see [People and roles](users.md#roles-and-permissions)).
- A missing, ended or invalid token answers `401` with a short plain-text message, not JSON.

For a program that only sends sensor readings, use an **API key** instead of a person's account: see [Sensors and IoT](iot.md).

## Answers

Most endpoints answer in one of two ways, and a few use a third, so read the answer of the endpoint you use:

- A **list** is an object with the list under the resource's name and the paging in `meta`:

    ```json
    { "work_orders": [ ... ], "meta": { "current_page": 1, "total_pages": 2, "total_count": 28, "per_page": 25 } }
    ```

    A few lists (audit log, IoT alerts) also carry `"success": true` and put the paging one level down, under `meta.pagination`.
- A **single record** is `{ "data": { ... } }`.
- Some endpoints answer with a small object of their own (`{"message": "..."}`, or counts), or with no body (`204`).

**Paging.** Lists hold 25 records a page and take `page` (`?page=2`). The page size cannot be changed: `limit`, `per_page` and `items` are ignored. A page past the end gives the last page.

### Errors

An error is `{ "success": false, "error": { "code": "...", "message": "...", "details": {...} }, "meta": {...} }` (`details` is there for validation errors, field by field), with these statuses:

| Status | `code` | Meaning |
| --- | --- | --- |
| 400 | `MISSING_PARAMETER`, `BAD_REQUEST` | A required part of the request is missing or malformed |
| 401 | `NO_TENANT` | No company for this request |
| 403 | `FORBIDDEN` | The person's role may not do this |
| 403 | `TWO_FACTOR_SETUP_REQUIRED` | The company requires [two-factor sign-in](security.md#two-factor-sign-in) and this person has not set it up |
| 404 | `RESOURCE_NOT_FOUND` | No such record, or it belongs to another company |
| 422 | `VALIDATION_ERROR` | The record is not valid; `details` says which fields |
| 422 | `INVALID_TRANSITION` | A work order cannot move that way (see [Work orders](work-orders.md)) |
| 429 | `RATE_LIMITED` | Too many requests; the `Retry-After` header says how many seconds to wait |
| 500 | `INTERNAL_ERROR` | A fault on the server; it is in the server log with the `request_id` from `meta` |

Some endpoints give a more specific `code` of their own (for example `CHECKLIST_LOCKED`, `TWO_FACTOR_LOCKED`, `PUBLIC_REQUESTS_OFF`).

## Examples

Make a work order, then list them:

```bash
curl -X POST https://fixflow.example.com/api/v1/work_orders \
  -H 'Authorization: Bearer eyJ...' -H 'Content-Type: application/json' \
  -d '{"work_order":{"title":"Pump 3 is leaking","description":"Oil on the floor","priority":"high"}}'
# {"data":{"id":1,"work_order_number":"WO-000001","status":"open","priority":"high", ...}}

curl 'https://fixflow.example.com/api/v1/work_orders?page=1' -H 'Authorization: Bearer eyJ...'
```

A work order moves through its states with `PATCH /api/v1/work_orders/:id/start`, `hold`, `complete`, `verify` and so on; the endpoints are in the [list](api-endpoints.md#work-orders).

Send a sensor reading (an API key made under **Settings, API Keys**, shown once when it is made):

```bash
curl -X POST https://fixflow.example.com/api/v1/iot/ingest \
  -H 'X-API-Key: <the key>' -H 'Content-Type: application/json' \
  -d '{"asset_id":"PUMP-3","metric":"temperature","value":72.4,"unit":"C"}'
# {"received":1,"processed":1,"alerts_triggered":0,"work_orders_created":0,"errors":[]}
```

## Limits

Limits are counted per address (per API key for sensor readings) and answer `429`:

| What | Limit |
| --- | --- |
| All API requests | 300 per 5 minutes per address |
| `POST /auth/sign_in`, and `POST /auth/two_factor` | 10 per minute per address |
| Forgot password: asking for a link, and using one | 5 and 10 per minute per address |
| `PATCH /profile/password` | 5 per minute per signed-in token |
| AI endpoints | 5 per minute per token |
| `POST /iot/ingest` | 1,000 per minute per API key |
| The public request form (`POST /work_requests`) | 5 per 10 minutes and 20 per day per address, 60 per hour from everyone |
| Looking up a public request link or asset code | 60 per 5 minutes per address |

Behind a proxy the address is the one the proxy reports in `X-Forwarded-For`; make sure it sets it, or every caller shares one allowance. `BLOCKED_IPS` (a comma-separated list in `.env`) refuses addresses outright.

## Without signing in

These need no token: `POST /auth/sign_in`, `POST /auth/two_factor`, `POST /auth/sign_up` (only until the first company exists), `GET /setup/status`, `GET /health`, the forgotten-password and invitation endpoints (`/auth/password`, `/invitations/:token`), the public request form and its lookups (`/work_requests`, `/public_assets/:code`, `/public_request_form`; see [Work orders](work-orders.md#reporting-a-problem-without-an-account-qr-labels)), and `POST /iot/ingest` (which needs an API key instead).

## Live updates

`/cable` is a WebSocket (ActionCable) that pushes new IoT alerts to a signed-in browser. The token goes in the address (`wss://.../cable?token=...`) because a browser WebSocket cannot send a header. A reverse proxy in front must pass WebSocket upgrades on `/cable`.
