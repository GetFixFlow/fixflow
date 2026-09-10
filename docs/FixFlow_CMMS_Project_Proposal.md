# FixFlow CMMS
## Open Source Project Proposal — Initial Release (v0.1)

---

> **Tagline:** The self-hostable, IoT-ready maintenance management system built for the teams that enterprise software forgot.

---

## 1. Executive Summary

**FixFlow** is a free and open-source Computerized Maintenance Management System (CMMS) designed for small-to-mid-sized organizations — factories, schools, hospitals, property managers, and municipalities — that cannot afford or justify IBM Maximo, ServiceNow, or Facilio.

The core promise is three things done exceptionally well:

- **Simple self-hosting** — running via a single `docker compose up` command with no specialist infrastructure knowledge required
- **IoT-ready from day one** — a first-class MQTT/REST ingestion layer so sensor data flows directly into work orders
- **A mobile UX that field technicians actually want to use** — not an afterthought, but the primary design target

The initial release (v0.1) will cover the essential CMMS workflow loop: asset registry → preventive maintenance schedules → work order management → technician dispatch → completion tracking.

---

## 2. Problem Statement

### Who Is Being Underserved?

The CMMS market has a sharp divide. On one side are enterprise platforms (IBM Maximo, ServiceNow, Facilio) priced at $50,000–$500,000+/year with 6-month implementation timelines. On the other side are spreadsheets and paper-based systems.

In between sits an enormous underserved segment:

| Sector | Typical Size | Their Pain |
|---|---|---|
| Small manufacturers | 20–200 employees | Can't afford Maximo; too complex for spreadsheets |
| School districts | 5–50 facilities staff | No budget, high compliance burden |
| Clinics & hospitals | 10–100 maintenance staff | Equipment compliance is critical but costly to manage |
| Property managers | 5–30 properties | Multi-site chaos, no unified system |
| Municipalities | 5–50 public works staff | Aging infrastructure, public accountability needs |

### Why Existing Open Source Falls Short

| Project | Problem |
|---|---|
| Atlas CMMS | Closest competitor, but mobile UX is weak; commercial license required for advanced features |
| openMAINT | Java/SOA stack, heavy to self-host, 2009-era UX |
| ERPNext CMMS | Buried inside a full ERP, overwhelming for maintenance teams |
| Snipe-IT | IT assets only, no maintenance scheduling |

**The gap:** No open source CMMS combines clean self-hosting, first-class IoT hooks, and a mobile-first UX in one cohesive package.

---

## 3. Project Vision & Principles

**Design Principles for v0.1:**

1. **10-minute self-host** — From `git clone` to working dashboard in under 10 minutes using Docker
2. **Mobile-first, not mobile-compatible** — Every screen designed for a technician with greasy hands on a phone
3. **IoT as a first-class citizen** — MQTT broker integration and REST webhooks ship in v0.1, not as a future plugin
4. **Opinionated but escapable** — Strong defaults, but all data exportable as open formats (CSV, JSON)
5. **AI-assisted, not AI-dependent** — Smart suggestions (auto-priority, anomaly flags) enhance the workflow without locking users into any AI vendor
6. **Contributor-friendly** — Clean codebase, comprehensive docs, well-scoped issues

---

## 4. Target Users

### Primary: The Field Technician
- Works on a phone or tablet in the field
- Needs to see their assigned work orders instantly
- Must be able to log completion with a photo and notes in under 60 seconds
- Often has poor network connectivity (offline mode is critical)

### Secondary: The Facilities/Maintenance Manager
- Needs visibility across all assets and open work orders
- Schedules preventive maintenance and assigns technicians
- Generates compliance reports for management or regulators

### Tertiary: The IT/Systems Administrator
- Deploys and maintains the self-hosted instance
- Configures IoT integrations and user access
- Needs clear documentation and low operational complexity

---

## 5. Core Features — Initial Release (v0.1)

### 5.1 Asset Management
- Hierarchical asset registry (Site → Building → Floor → Equipment)
- Custom fields per asset type (serial number, manufacturer, purchase date, warranty expiry)
- QR code generation per asset — technicians scan to pull up asset history instantly
- Asset status tracking (Operational / Degraded / Down / Decommissioned)
- Maintenance history log per asset

### 5.2 Work Order Management
- Create, assign, and track corrective work orders
- Priority levels: Critical / High / Medium / Low
- Rich work order detail: description, asset link, photos, checklist steps, notes
- Status workflow: Open → In Progress → Pending Parts → Completed → Verified
- Work request portal — non-technical staff can submit requests without a full account
- Completion logging with photo evidence and technician notes

### 5.3 Preventive Maintenance Scheduling
- Schedule recurring maintenance by: calendar interval, meter reading (hours/cycles), or condition trigger
- Auto-generate work orders on schedule
- PM compliance dashboard — at-a-glance view of scheduled vs. completed maintenance
- Maintenance templates — reusable checklists for common PM tasks

### 5.4 IoT Integration Layer *(Key Differentiator)*
- Built-in MQTT broker connection (compatible with Mosquitto, HiveMQ, EMQX)
- REST webhook endpoint for sensor data ingestion
- Rule engine: define thresholds that auto-generate work orders
  - Example: "If vibration sensor on Pump-03 exceeds 8.5 mm/s → create Critical work order"
- Real-time sensor reading dashboard per asset
- Alert log with acknowledged/unacknowledged status
- Compatible protocols in v0.1: MQTT, HTTP REST
- Planned for v0.2: Modbus-TCP, OPC-UA bridge

### 5.5 Mobile Application
- Progressive Web App (PWA) — installable on Android and iOS without app store
- Works offline — work orders sync when connectivity is restored
- QR code scanner using device camera
- Photo capture for work order evidence
- Push notifications for new assignments and escalations
- Optimized for one-handed operation: large touch targets, minimal typing

### 5.6 Parts & Inventory (Basic)
- Spare parts catalog linked to assets
- Stock level tracking with low-stock alerts
- Parts consumed logging per work order
- Basic reorder point notification

### 5.7 Reporting & Dashboards
- Live operations dashboard: open WOs, overdue PM, asset health overview
- MTTR (Mean Time to Repair) per asset/location
- PM compliance rate over time
- Technician workload and completion metrics
- Export: CSV and PDF for all reports

### 5.8 User Management & Access Control
- Role-based access: Admin / Manager / Technician / Requester
- Multi-site support — technicians scoped to specific locations
- SSO via OAuth2 (Google, GitHub, LDAP) — optional, not required
- Audit log of all changes

---

## 6. Technical Architecture

### 6.1 Technology Stack

| Layer | Technology | Rationale |
|---|---|---|
| Frontend | React 19 + TypeScript | Dominant ecosystem, excellent component library support, PWA-ready |
| UI Components | Tailwind CSS + shadcn/ui | Clean, accessible, fast to build with |
| State Management | Zustand + TanStack Query | Lightweight, battle-tested, offline-capable |
| Backend API | Node.js + NestJS | TypeScript end-to-end, structured and scalable, strong IoT library support |
| Database | PostgreSQL 16 | ACID compliance for relational maintenance data, excellent JSON support |
| ORM | Prisma | Type-safe, excellent migration tooling |
| IoT Layer | Aedes (MQTT broker) + custom REST ingestion | Self-contained MQTT without external broker dependency |
| Real-time | WebSockets via Socket.io | Live work order updates and sensor readings |
| File Storage | MinIO (self-hosted S3-compatible) | Photo evidence storage, fully self-contained |
| Auth | NextAuth / Passport.js + JWT | Flexible, supports local + OAuth2 |
| Containerization | Docker + Docker Compose | Single-command deployment |
| Mobile PWA | Workbox (service worker) | Offline-first caching and background sync |

### 6.2 System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        IoT Devices                          │
│   [Sensors] ──MQTT──► [MQTT Broker]                         │
│   [PLCs]    ──REST──► [Webhook API]                         │
└─────────────────────┬───────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    FixFlow Backend (NestJS)                  │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ REST API     │  │ IoT Ingestion│  │  Rule Engine      │  │
│  │ /api/v1      │  │ MQTT + HTTP  │  │  Threshold Alerts │  │
│  └──────────────┘  └──────────────┘  └───────────────────┘  │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ WebSocket    │  │ Scheduler    │  │  Auth (JWT/OAuth) │  │
│  │ Live Updates │  │ PM Engine    │  │                   │  │
│  └──────────────┘  └──────────────┘  └───────────────────┘  │
│                          │                                   │
│              ┌───────────┴───────────┐                      │
│         [PostgreSQL]            [MinIO]                      │
│         (Core Data)          (File Storage)                  │
└─────────────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                 FixFlow Frontend (React PWA)                 │
│   Web Dashboard    │    Mobile PWA    │   Work Request Portal│
│   (Managers)       │   (Technicians)  │   (Any Staff)        │
└─────────────────────────────────────────────────────────────┘
```

### 6.3 Self-Hosting Deployment

The entire stack runs via a single `docker-compose.yml`:

```yaml
# One command: docker compose up -d
services:
  api:       # NestJS backend
  web:       # React frontend (served via Nginx)
  db:        # PostgreSQL
  minio:     # File storage
  mqtt:      # Aedes MQTT broker
```

Minimum server requirements: **2 vCPU, 2GB RAM, 20GB storage**

Compatible with: any Linux VPS, Raspberry Pi 4, on-premise server, or cloud VM (AWS/GCP/Azure/DigitalOcean).

---

## 7. IoT Integration — Design Detail

This is FixFlow's key differentiator and deserves specific design attention.

### Ingestion Methods

**Method 1 — MQTT (Push from devices)**
```
Device → publishes to topic: fixflow/assets/{asset_id}/telemetry
Payload: { "temperature": 72.4, "vibration": 3.2, "timestamp": "..." }
```

**Method 2 — REST Webhook (Pull/push from gateways)**
```
POST /api/v1/iot/ingest
Headers: X-API-Key: {key}
Body: { "asset_id": "pump-03", "readings": { "pressure": 4.2 } }
```

### Rule Engine

Administrators define threshold rules in the UI:

| Asset | Sensor | Condition | Action |
|---|---|---|---|
| Pump-03 | vibration | > 8.5 mm/s | Create Critical Work Order |
| HVAC-01 | temperature | > 85°C for 5 min | Create High Work Order + Alert Manager |
| Generator-01 | runtime_hours | = 500 | Create PM Work Order |

### Data Retention

Raw sensor readings stored for 90 days by default (configurable). Aggregated hourly/daily summaries retained permanently for trend analysis.

---

## 8. Development Roadmap

### Phase 1 — Foundation (Months 1–2)
- [ ] Project scaffolding: monorepo (Turborepo), Docker setup, CI/CD pipeline
- [ ] Database schema design and Prisma migrations
- [ ] Authentication system (local + OAuth2)
- [ ] Core REST API: assets, work orders, users, locations
- [ ] Basic React frontend: login, dashboard skeleton, asset list

### Phase 2 — Core CMMS Loop (Months 3–4)
- [ ] Full work order lifecycle (create → assign → complete → verify)
- [ ] Preventive maintenance scheduling engine
- [ ] PM auto-generation from schedules
- [ ] Mobile PWA: offline work order management, QR scanner, photo capture
- [ ] Work request portal (unauthenticated submission)
- [ ] Basic parts inventory

### Phase 3 — IoT Layer (Month 5)
- [ ] MQTT broker integration (Aedes embedded)
- [ ] REST webhook ingestion endpoint
- [ ] Sensor reading storage and asset telemetry dashboard
- [ ] Rule engine UI and threshold alert system
- [ ] Auto work order generation from sensor rules

### Phase 4 — Polish & Launch (Month 6)
- [ ] Reporting module (MTTR, PM compliance, technician performance)
- [ ] CSV/PDF export
- [ ] Email/push notification system
- [ ] Full documentation site (docs.fixflow.dev)
- [ ] One-click deploy guides (DigitalOcean, Railway, Fly.io, bare metal)
- [ ] Community setup: GitHub Discussions, Discord, contribution guide
- [ ] **Public v0.1 release**

---

## 9. AI Capabilities — Phased Approach

AI is not in scope for v0.1 (focus is on solid core functionality), but the architecture prepares for it:

**v0.2 — Smart Alerts**
- Anomaly detection on sensor time-series data (flag unusual readings without manual thresholds)
- Auto-prioritization of work orders based on asset criticality and historical failure patterns

**v0.3 — Predictive Maintenance**
- Remaining Useful Life (RUL) estimation from sensor trends
- Failure mode prediction using maintenance history
- Parts demand forecasting based on historical consumption

**v0.4 — Natural Language**
- Voice/text work order creation for technicians ("the pump on line 3 is leaking oil")
- AI-powered maintenance report summaries
- Chat-based asset query ("when was HVAC-01 last serviced?")

---

## 10. Licensing & Sustainability

**License:** GNU AGPLv3

The AGPL ensures the project remains open: any hosted or distributed version must also be open source. This prevents the "open core" trap where the useful features are paywalled.

### Sustainability Model (Post-Launch)

| Revenue Stream | Description |
|---|---|
| Managed Cloud Hosting | fixflow.cloud — hosted version for teams who don't want to self-host |
| Enterprise Support | SLA-backed support contracts for organizations that need guarantees |
| Professional Services | Custom integrations, IoT setup, data migration |
| Sponsored Features | Companies can fund specific features they need |

The core project remains free forever. Revenue funds full-time maintenance and development.

---

## 11. Competitive Positioning

| | FixFlow | Atlas CMMS | openMAINT | IBM Maximo |
|---|---|---|---|---|
| Open Source (OSI) | ✅ AGPLv3 | ⚠️ AGPL (limits commercial) | ✅ | ❌ |
| Self-hosted | ✅ Docker | ✅ Docker | ✅ Java | ❌ SaaS only |
| IoT/MQTT built-in | ✅ v0.1 | ❌ Plugin | ❌ | ✅ Enterprise |
| Mobile PWA | ✅ Offline-first | ⚠️ Limited | ❌ | ✅ |
| Setup time | ~10 min | ~30 min | Hours | Months |
| Target size | SMB | SMB | Enterprise | Enterprise |
| Annual cost | Free | Free (limited) | Free | $50K–500K+ |

---

## 12. Project Name & Identity

**Project Name:** FixFlow

**Rationale:** Communicates the core workflow (fix things, manage the flow of maintenance work) without being overly technical. Easy to remember, domain-friendly, and works as a brand.

**Repository:** `github.com/GetFixFlow/fixflow`

**Tagline:** *Maintenance management that works as hard as your team*

---

## 13. Success Metrics for v0.1

| Metric | 3-Month Target | 6-Month Target |
|---|---|---|
| GitHub Stars | 500 | 2,000 |
| Active self-hosted installs | 50 | 300 |
| Community contributors | 5 | 20 |
| Discord members | 100 | 500 |
| Documented production deployments | 5 | 30 |

---

## 14. What This Project Is NOT

Being explicit about scope prevents feature creep:

- ❌ Not a full ERP system
- ❌ Not a project/task management tool (like Notion or Jira)
- ❌ Not a SCADA or industrial control system
- ❌ Not an IT asset management tool (Snipe-IT does that well)
- ❌ Not a real-time PLC controller

FixFlow is narrowly focused on the maintenance workflow loop for physical assets. Everything else is out of scope until the core is exceptional.

---

## 15. Immediate Next Steps

1. **Reserve the name** — GitHub org, domain (fixflow.dev), npm package scope
2. **Set up the monorepo** — Turborepo with `apps/web`, `apps/api`, `packages/db`, `packages/types`
3. **Design the database schema** — Asset, WorkOrder, PM Schedule, Sensor Reading, User, Location tables
4. **Build the Docker Compose stack** — get a working skeleton deployable in one command
5. **Create the GitHub project board** — milestone-based issues for Phase 1
6. **Write the CONTRIBUTING.md** — attract early contributors from the start

---

*Proposal Version 1.0 — April 2026*
*Author: Project Founder*
*Status: Ready for review*
