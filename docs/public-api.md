# Public API, API keys and webhooks

Connect FixFlow to your other systems: read and change work orders and assets from a script, n8n, Zapier or your own program, and have FixFlow tell another system the moment something happens (a work order is completed, an asset goes down, a sensor alert is raised).

- **API keys** let a program in. Each has **scopes** that say what it may do, so a report script can be given a key that only reads.
- **The public API** (`/api/v1/open`) is the part of the API made for programs: a small, steady set of endpoints with simple answers.
- **Webhooks** are FixFlow calling out: an address you give it, and the events you want sent there, each message signed so the receiver knows it is from you.

!!! note "Before 1.0"
    The public API is versioned by its address (`/api/v1/open`), and within a version a field is only ever **added** to an answer, never renamed or removed. FixFlow itself is before 1.0, so a breaking change would be a new version at a new address, announced in the [changelog](changelog.md). The rest of the API (the one the web app uses) can still change; use `/api/v1/open` for anything that must keep working.

## API keys and scopes

An administrator makes a key under **Settings → IoT & API Keys → Create API Key**. The key is shown **once**; FixFlow keeps only a hash of it, so a lost key is replaced, not recovered. Give each program its own key, so one can be revoked without touching the others, and set an expiry for anything temporary.

| Scope | What the key may do |
| --- | --- |
| `iot` | Send sensor readings (`POST /api/v1/iot/ingest`, see [Sensors and IoT](iot.md)). Nothing else. |
| `read` | Read work orders, assets, locations and parts through the public API. |
| `write` | Everything `read` does, and create and change work orders and assets, and move a work order along (start, complete, cancel...). |

A key can have several. Keys made before scopes existed (and keys with the old `iot_write` and `iot_read` names) count as `iot`: they keep sending readings and cannot use the public API until a new key is made for it.

Send the key in the `Authorization` header (or `X-API-Key`), never in the address, where it would end up in logs:

```bash
curl https://fixflow.example.com/api/v1/open/me -H 'Authorization: Bearer fxk_...'
```

```json
{ "data": { "key": { "id": 3, "name": "Reports script", "scopes": ["read"], "expires_at": null },
            "organization": { "id": 1, "name": "Acme Plant" } } }
```

`/me` answers for any valid key, so it is the call for "test connection". A key sees **only its own company**, and every change it makes is in the [audit log](security.md) with the key's name. Revoke a key on the same page; it stops working at once.

## What the public API offers

Every answer is `{ "data": ... }`, and a list also has `meta`. Errors have the shape described in [API](api.md#errors), with codes such as `INVALID_API_KEY` (401), `INSUFFICIENT_SCOPE` (403), `RESOURCE_NOT_FOUND` (404), `VALIDATION_ERROR` (422), `INVALID_TRANSITION` (422), `APPROVAL_REQUIRED` (422) and `CHECKLIST_INCOMPLETE` (422).

| Method and address | Scope | What it does |
| --- | --- | --- |
| `GET /me` | any | Which key this is, its scopes and its company |
| `GET /work_orders` | read | List. Filters: `status` (comma separated), `priority`, `asset_id`, `assignee_id`, `q` (text), `updated_since`, `created_since` |
| `GET /work_orders/:id` | read | One work order |
| `POST /work_orders` | write | Create: `{"work_order": {"title": "...", "description": "...", "priority": "high", "due_date": "...", "asset_id": 12}}`. The requester is the key's name unless you pass `requester_name` and `requester_email` |
| `PATCH /work_orders/:id` | write | Change title, description, priority, due date, asset, assignee, estimate, custom values |
| `POST /work_orders/:id/transitions` | write | `{"event": "complete", ...}` with `event` one of `assign`, `start`, `hold`, `need_parts`, `resume`, `complete`, `cancel`: the same rules as on screen. `assign` needs `assignee_id`; `complete` needs `completion_notes` (and may take `actual_hours`); `cancel` may take `cancellation_reason`. Verifying and rejecting finished work are left to people |
| `GET /assets`, `GET /assets/:id` | read | Assets that are not deleted. Filters: `status`, `location_id`, `q`, `updated_since` |
| `POST /assets`, `PATCH /assets/:id` | write | Create or change an asset (setting it to `down` starts a downtime, as on screen) |
| `GET /locations`, `GET /locations/:id` | read | Locations, with `parent_id` |
| `GET /parts`, `GET /parts/:id` | read | Parts and stock; `low_stock=true` lists those at or under their reorder point |
| `GET /openapi` | none | This API described in OpenAPI 3, for tools |

The addresses above are under `/api/v1/open`. Nothing here deletes anything, and nothing touches people, settings, keys or what anyone is paid (labour cost and rates are not in the answers).

**Paging and sorting.** Lists hold 25 a page; `page` and `per_page` (up to 100) choose; `meta` says `page`, `per_page`, `total_count` and `total_pages`. `sort` takes `created_at`, `updated_at` or `id`, with a leading `-` for newest first.

**What changed, without webhooks.** `updated_since` takes a time (`2026-11-01T09:00:00Z`) and answers what changed at or after it; with `sort=updated_at` the oldest comes first, so a program can poll every few minutes and carry on from the last `updated_at` it saw.

**Limits.** 600 requests a minute for each key (and 1,200 for each address). Over the limit the answer is `429` with a `Retry-After` header.

```bash
# the open work orders, then complete one
curl 'https://fixflow.example.com/api/v1/open/work_orders?status=open,assigned&per_page=50' -H 'Authorization: Bearer fxk_...'
curl -X POST https://fixflow.example.com/api/v1/open/work_orders/42/transitions \
  -H 'Authorization: Bearer fxk_...' -H 'Content-Type: application/json' \
  -d '{"event":"complete","completion_notes":"Replaced the seal","actual_hours":1.5}'
```

The OpenAPI description is at `/api/v1/open/openapi` (no key needed): import it into Postman, Insomnia or a code generator.

## Webhooks

**Settings → Webhooks → Add webhook.** Give it a name, the address to send to, and tick the events. FixFlow shows the **signing secret once**; copy it into the receiver. **Send a test message** checks the address straight away and shows what the receiver answered.

| Event | Sent when |
| --- | --- |
| `work_order.created` | A work order is created (by a person, a QR label, a schedule, a sensor rule or the API) |
| `work_order.assigned` | It is assigned to someone |
| `work_order.started` | Work starts or starts again (after a hold, or after finished work is sent back) |
| `work_order.on_hold` | It is put on hold |
| `work_order.pending_parts` | It is waiting for parts |
| `work_order.completed` | Work is finished |
| `work_order.verified` | A manager verifies the finished work |
| `work_order.cancelled` | It is cancelled |
| `asset.created` | An asset is added |
| `asset.status_changed` | An asset's status changes (operational, degraded, down) |
| `iot_alert.created` | A sensor alert is raised |
| `part.low_stock` | A part falls to its reorder point or runs out (`changes.stock` is `low` or `out`) |

Each message is a `POST` with a JSON body, in the same shape the public API answers with:

```json
{
  "id": "evt_5f0c1a3e-...",
  "event": "work_order.completed",
  "created_at": "2026-11-11T10:22:31Z",
  "data": { "work_order": { "id": 42, "number": "WO-000042", "title": "Pump 3 is leaking", "status": "completed",
                            "completion_notes": "Replaced the seal", "asset": { "id": 7, "name": "Pump 3", "asset_tag": "FF-000007" },
                            "assignee": { "id": 5, "name": "Tia Nguyen", "email": "tia@example.com" },
                            "url": "https://fixflow.example.com/work-orders/42" } },
  "changes": { "status": ["in_progress", "completed"] }
}
```

and these headers: `X-FixFlow-Event` (the event), `X-FixFlow-Delivery` (the `id`: the same for every attempt of a message, so a receiver can ignore one it has had), `X-FixFlow-Attempt` (1 for the first try) and `X-FixFlow-Signature`.

**Answer with any 2xx, quickly.** Do the work afterwards: FixFlow waits 10 seconds at most.

### Checking the signature

`X-FixFlow-Signature: t=1700000000,v1=<hex>` holds the time the message was signed and an HMAC-SHA256 of `<time>.<raw body>` made with your webhook's secret. A receiver that checks it knows the message came from FixFlow and was not changed; checking the time as well (five minutes is fine) refuses an old message someone captured and sends again. Always use the **raw** body, exactly as received, not a re-written copy of the parsed JSON.

**Node.js**

```js
const crypto = require('crypto')

function verify(rawBody, header, secret, toleranceSeconds = 300) {
  const parts = Object.fromEntries(header.split(',').map((part) => part.split('=')))
  if (!parts.t || !parts.v1) return false
  if (Math.abs(Date.now() / 1000 - Number(parts.t)) > toleranceSeconds) return false // too old: a message sent again by someone else
  const expected = crypto.createHmac('sha256', secret).update(`${parts.t}.${rawBody}`).digest('hex')
  const given = Buffer.from(parts.v1)
  const wanted = Buffer.from(expected)
  return given.length === wanted.length && crypto.timingSafeEqual(given, wanted)
}
```

**Python**

```python
import hashlib
import hmac
import time


def verify(raw_body: bytes, header: str, secret: str, tolerance: int = 300) -> bool:
    parts = dict(part.split("=", 1) for part in header.split(","))
    if "t" not in parts or "v1" not in parts:
        return False
    if abs(time.time() - int(parts["t"])) > tolerance:  # too old: a message sent again by someone else
        return False
    expected = hmac.new(secret.encode(), parts["t"].encode() + b"." + raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, parts["v1"])
```

**Ruby**

```ruby
require "openssl"

def verify(raw_body, header, secret, tolerance: 300)
  parts = header.split(",").to_h { |part| part.split("=", 2) }
  return false unless parts["t"] && parts["v1"]
  return false if (Time.now.to_i - parts["t"].to_i).abs > tolerance # too old: a message sent again by someone else

  expected = OpenSSL::HMAC.hexdigest("SHA256", secret, "#{parts['t']}.#{raw_body}")
  expected.bytesize == parts["v1"].bytesize && OpenSSL.fixed_length_secure_compare(expected, parts["v1"])
end
```

These three were run against messages signed by FixFlow's own signer: a right signature passes, and a wrong secret, a changed body and an old message are refused.

### Delivery, retries and failures

- A message that is not taken (no answer, or not a 2xx) is tried again after **1 minute, 5 minutes, 30 minutes, 2 hours and 6 hours**: six attempts over about nine hours, then it is marked failed. **Settings → Webhooks** shows every message of the last 30 days, with the answer or the reason, and **Send again** sends one afresh (with the same `X-FixFlow-Delivery`).
- A receiver that answers **410 Gone** is switched off at once; one whose messages **fail ten times in a row** is switched off too, with the reason shown. Fix the receiver, then **Switch on again**.
- Redirects are not followed. Addresses on your own network are fine (n8n in the office), but not the FixFlow server itself or link-local addresses such as `169.254.169.254`. The address is checked again before every message, and the connection goes to the address that was checked.
- **Renew secret** gives a new secret at once; the old one stops signing immediately, so update the receiver first if it matters.
- A company can have 20 webhooks. Records of messages are kept 30 days.
- Messages are made in order but may arrive out of order after a retry: go by the `updated_at` and `changes` in a message, not the order of arrival.

## n8n

*Written from n8n's documented nodes; not run in n8n here.*

**Reading FixFlow.** Add an **HTTP Request** node: method `GET`, URL `https://fixflow.example.com/api/v1/open/work_orders`, **Authentication → Generic Credential Type → Header Auth** with name `Authorization` and value `Bearer fxk_...`, and under **Send Query Parameters** `status` = `open,assigned`. The answer's `data` array is what to loop over (a **Split Out** node on `data`). To fetch only what changed, keep the newest `updated_at` you saw and send it as `updated_since` next time, with `sort` = `updated_at`.

**Reacting to FixFlow.** Add a **Webhook** trigger node (HTTP method `POST`), copy its **Production URL** into a new FixFlow webhook, tick the events, and press **Send a test message**. n8n shows the message; then use `{{ $json.body.data.work_order.title }}` and the rest in the nodes after it. To check the signature, turn on **Raw Body** in the Webhook node's options and add a **Code** node that runs the Node.js check above on the raw body and the `x-fixflow-signature` header. Without the check, anyone who learns the URL can send it messages, so keep the URL secret or check.

## Zapier

*Written from Zapier's documented apps; not run in Zapier here.*

**Reacting to FixFlow.** Make a Zap whose trigger is **Webhooks by Zapier → Catch Hook**, copy its custom webhook URL into a new FixFlow webhook, tick the events and send a test message so Zapier can see the fields (`data__work_order__title`, `data__work_order__status`, ...). Zapier has no way to check the signature without a **Code by Zapier** step; the URL is the secret, so do not share it.

**Reading or changing FixFlow.** Use **Webhooks by Zapier → Custom Request**: method `GET` or `POST`, URL `https://fixflow.example.com/api/v1/open/work_orders`, **Headers** `Authorization: Bearer fxk_...` (and `Content-Type: application/json` with a JSON body for a `POST`). A Zap that makes a work order from a form or an email is a `POST` to `/work_orders` with `{"work_order": {"title": "...", "description": "...", "requester_name": "..."}}`.

## Safety, in short

- Give each program its own key with the **least scope** it needs, and an expiry where it is temporary. Revoke a key that may have leaked.
- Keep keys and signing secrets out of code repositories. Keys are stored hashed and secrets encrypted in FixFlow, and each is shown once.
- Use `https` for receivers outside your network.
- A `write` key can change work orders and assets: anyone who has it can. It cannot reach people, settings or other keys.
