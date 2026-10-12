# Changelog

All notable changes to FixFlow CMMS will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

- First-run setup screen (`/setup`). Public sign-up now closes once a company exists, so a private install can no longer be used to create a second company. New `GET /api/v1/setup/status` endpoint.
- Fixed the sign-up form sending `full_name` while the API requires `first_name` and `last_name`, so sign-up from the web app always failed validation.
- Settings pages: profile, notifications, security, organization, branding, users, roles, IoT, data retention, audit log, import/export, advanced
- Onboarding flow

## [0.1.0] - 2026-06-22

### Added

- **Core CMMS loop**: Assets, Work Orders, Preventive Maintenance scheduling
- **IoT ingestion layer**: REST webhook + MQTT-compatible sensor ingestion with rule engine
- **React 18 PWA frontend**: TypeScript + Vite + Tailwind CSS + TanStack Query v5
- **Assets & Locations UI**: full CRUD, QR code scanning/printing, asset import, location hierarchy
- **Work Orders UI**: list, create, edit, detail views with real-time status updates via ActionCable
- **Preventive Maintenance UI**: PM dashboard, schedule management, compliance tracking
- **Reports & Analytics UI**: 7 report types with Recharts visualisations — work orders, asset health, PM compliance, IoT analytics, technician performance, cost analysis
- **Role-based access control**: Admin, Manager, Technician, Requester roles
- **JWT authentication**: Devise + devise-jwt with Bearer tokens
- **Background jobs**: Sidekiq + Redis for PM schedule processing and notifications
- **File storage**: ActiveStorage backed by MinIO (S3-compatible)
- **Production build**: Multi-stage Docker build, nginx SPA config, docker-compose production stack
- **Performance**: Code-split vendor chunks, lazy-loaded routes, Web Vitals reporting, PWA with service worker caching
