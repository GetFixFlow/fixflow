# Sensors and IoT

Send sensor readings over REST or MQTT, set rules, and handle alerts.

## IoT Ingestion (no JWT, uses API key)
```bash
POST /api/v1/iot/ingest
Headers: X-API-Key: <an API key made under Settings, API Keys>
Body: { "asset_id": 1, "metric": "temperature", "value": 72.4, "unit": "C" }
# or several readings from one device:
Body: { "asset_id": 1, "device_id": "pump-1", "timestamp": "2026-05-03T10:00:00Z",
        "readings": [ { "metric": "temperature", "value": 72.4, "unit": "C" }, { "metric": "vibration", "value": 3.2, "unit": "mm/s" } ] }
```
`asset_tag` can be used instead of `asset_id`. A body that is a list of readings, each naming its asset, is accepted too.

## MQTT
Devices connect to the broker on port 1883 with `MQTT_USERNAME` and `MQTT_PASSWORD` (a connection without them is refused) and publish to:

```
fixflow/<company token>/assets/<asset id or asset tag>/telemetry
Payload: { "metric": "temperature", "value": 72.4, "unit": "C" }
     or: { "device_id": "pump-1", "readings": [ { "metric": "vibration", "value": 3.2, "unit": "mm/s" } ] }
```

The company token is the company name in lowercase with dashes (Acme Plant is `acme-plant`); `GET /api/v1/organization_settings` shows it as `slug`. The asset can also be named in the payload (`asset_id`) on `fixflow/<company token>/telemetry`. A message that names no known asset is logged and dropped.

Exactly one process listens to the broker, the background worker: the broker hands every subscriber every message, so a second listener (the web server too) would store each reading twice. `MQTT_SUBSCRIBER=true` or `false` overrides which process it is, for a server with no worker.

## IoT alerts and rules

**Rules** (**IoT → Rules**, managers and administrators) say when a sensor reading is a problem: a metric on an asset, a limit (or a range), how long it must last, and whether to open a work order (with a cooldown so one fault does not open a hundred). A rule can be **paused**, **resumed**, **archived** (it stops; nothing is deleted) or **duplicated** (the copy is **paused**, with fresh counts, so it does not raise a second set of alerts until you switch it on). **Test** asks "what would happen if a sensor read 91?": it answers in words (alert, work order, cooldown, paused) and shows the last five readings and which of them would have set the rule off. A rule's assignee must be an active person in your company.

**Alerts** (**IoT → Alerts**) are raised by rules. An alert's **severity** is its rule's work order priority (critical, high, medium or low). Managers and administrators can move an alert along:

| From | Can become |
| --- | --- |
| open | acknowledged, resolved, suppressed |
| acknowledged | resolved, suppressed |
| suppressed | resolved |
| resolved | nothing |

An alert that cannot make the move you ask for is refused with the reason. **Bulk** acknowledge and resolve take up to 200 alerts: each one that can move does, and the answer says how many were skipped (already dealt with, or not found). Each asset's own alert history is at `GET /api/v1/assets/:id/iot_alerts`.

### The IoT screens: monitor, report and live alerts

**IoT → Monitor** (everyone signed in) shows what the sensors are doing now, counted from the stored readings and alerts:

- **Active sensors**: each metric on each asset that has reported within the **stale limit** (Settings → Company, default 5 minutes); **assets monitored**: assets that reported in the last 24 hours.
- **Readings per hour**: the last 60 minutes, and the change against the 60 before that.
- **Open alerts** by severity, **active rules**, and rules that **set something off today**.
- **Asset status**: each monitored asset's latest value for each metric, whether it is past its rule's limit, how close it is (for "above" rules the reading over the limit; for "below" rules the limit over the reading), and whether the sensor has gone quiet. Assets with a metric past its limit come first; 24 are shown.
- **Readings activity**: one point per hour for the last week.

If the figures cannot be loaded the page says so and offers **Try again**. "Updated … ago" is when the figures were really fetched.

**Live alerts.** While you are signed in, a new alert for your company appears as it happens: a toast for **critical** and **high** alerts (with a sound for critical, unless switched off in Settings → Notifications), the alert lists and the monitor refresh, the header bell shows a mark (click it to see the alerts and clear the mark), and the monitor shows **Live** when the connection is up. Live alerts are sent by the background worker (the one that also sends email) over a WebSocket at `/cable`; the browser sends its sign-in token in the address because a WebSocket cannot send a header. Your reverse proxy must pass WebSocket upgrades on `/cable`. A signed-out or ended session cannot connect.

**IoT → Reports → IoT Analytics** (managers and administrators) counts the alerts of the period: total, critical, still open, those with a work order, and the **share resolved** (nothing here resolves alerts by itself, so it is not an "auto-resolved" rate), a trend by day (by week for periods over 92 days) split by severity, how each rule did (alerts, work orders, share resolved, average hours to resolve), and, when one asset is chosen in the Filters, its metrics as a daily average. The Filters panel's assets, places and severities apply.
