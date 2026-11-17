# API endpoints

Every endpoint of the API, written from the server's routes by `rails docs:api` (do not edit this page by hand).
How to sign in, what answers look like and what the limits are is on the [API](api.md) page. In the paths, `:id` and
the like stand for a value, and `:format` is left out. Live updates are a WebSocket at `/cable`. The `auth` group also
holds the standard routes of the sign-in library that nothing uses (`sign_up/edit` and the like): the ones to use are
`sign_in`, `sign_out`, `two_factor`, `password` and `me`; `sign_up` works only until the first company exists.

The **Stability** column says what [version 1.0 promises](stability.md): **Stable** endpoints (the public API under
`/api/v1/open`, sensor ingestion and the health check) do not change within 1.x except by adding to them. **Web app**
endpoints are the web app's own: they change together with it, and the changelog says when they do, but a program
should not depend on them.

There are 293 endpoints in 53 groups, 17 of them stable: [activity_logs](#activity-logs), [ai](#ai), [ai_settings](#ai-settings), [api_keys](#api-keys), [asset_documents](#asset-documents), [assets](#assets), [auth](#auth), [backups](#backups), [branding](#branding), [chat_settings](#chat-settings), [custom_fields](#custom-fields), [dashboard](#dashboard), [data_usage](#data-usage), [directory_settings](#directory-settings), [downtimes](#downtimes), [email_settings](#email-settings), [getting_started](#getting-started), [health](#health), [imports](#imports), [invitations](#invitations), [iot](#iot), [iot_alerts](#iot-alerts), [iot_rules](#iot-rules), [localization_settings](#localization-settings), [locations](#locations), [meters](#meters), [notification_preferences](#notification-preferences), [open](#open), [organization_settings](#organization-settings), [parts](#parts), [plugin_reports](#plugin-reports), [plugins](#plugins), [preventive_maintenances](#preventive-maintenances), [profile](#profile), [public_assets](#public-assets), [public_request_form](#public-request-form), [purchase_orders](#purchase-orders), [push_subscriptions](#push-subscriptions), [reports](#reports), [sample_data](#sample-data), [saved_reports](#saved-reports), [schedule](#schedule), [sensor_anomalies](#sensor-anomalies), [sessions](#sessions), [setup](#setup), [sites](#sites), [storage](#storage), [system_health](#system-health), [users](#users), [vendors](#vendors), [webhooks](#webhooks), [work_orders](#work-orders), [work_requests](#work-requests).

## activity-logs

| Method | Path | Handled by | Stability |
| --- | --- | --- | --- |
| GET | `/api/v1/activity_logs` | `api/v1/activity_logs#index` | Web app |

## ai

| Method | Path | Handled by | Stability |
| --- | --- | --- | --- |
| POST | `/api/v1/ai/assist` | `api/v1/ai/assist#create` | Web app |
| GET | `/api/v1/ai/config` | `api/v1/ai/config#show` | Web app |
| GET | `/api/v1/ai/forecasts/limits` | `api/v1/ai/forecasts#limits` | Web app |
| GET | `/api/v1/ai/forecasts/parts` | `api/v1/ai/forecasts#parts` | Web app |
| POST | `/api/v1/ai/priority` | `api/v1/ai/priority#create` | Web app |
| POST | `/api/v1/ai/work_order_draft` | `api/v1/ai/drafts#create` | Web app |

## ai-settings

| Method | Path | Handled by | Stability |
| --- | --- | --- | --- |
| DELETE | `/api/v1/ai_settings` | `api/v1/ai_settings#destroy` | Web app |
| GET | `/api/v1/ai_settings` | `api/v1/ai_settings#show` | Web app |
| PATCH, PUT | `/api/v1/ai_settings` | `api/v1/ai_settings#update` | Web app |
| POST | `/api/v1/ai_settings/test` | `api/v1/ai_settings#test` | Web app |

## api-keys

| Method | Path | Handled by | Stability |
| --- | --- | --- | --- |
| GET | `/api/v1/api_keys` | `api/v1/api_keys#index` | Web app |
| POST | `/api/v1/api_keys` | `api/v1/api_keys#create` | Web app |
| DELETE | `/api/v1/api_keys/:id` | `api/v1/api_keys#destroy` | Web app |

## asset-documents

| Method | Path | Handled by | Stability |
| --- | --- | --- | --- |
| DELETE | `/api/v1/asset_documents/:id` | `api/v1/asset_documents#destroy` | Web app |

## assets

| Method | Path | Handled by | Stability |
| --- | --- | --- | --- |
| GET | `/api/v1/assets` | `api/v1/assets#index` | Web app |
| POST | `/api/v1/assets` | `api/v1/assets#create` | Web app |
| GET | `/api/v1/assets/:asset_id/documents` | `api/v1/asset_documents#index` | Web app |
| POST | `/api/v1/assets/:asset_id/documents` | `api/v1/asset_documents#create` | Web app |
| GET | `/api/v1/assets/:asset_id/downtimes` | `api/v1/downtimes#index` | Web app |
| POST | `/api/v1/assets/:asset_id/downtimes` | `api/v1/downtimes#create` | Web app |
| GET | `/api/v1/assets/:asset_id/meters` | `api/v1/meters#index` | Web app |
| POST | `/api/v1/assets/:asset_id/meters` | `api/v1/meters#create` | Web app |
| DELETE | `/api/v1/assets/:id` | `api/v1/assets#destroy` | Web app |
| GET | `/api/v1/assets/:id` | `api/v1/assets#show` | Web app |
| PATCH, PUT | `/api/v1/assets/:id` | `api/v1/assets#update` | Web app |
| GET | `/api/v1/assets/:id/history` | `api/v1/assets#history` | Web app |
| GET | `/api/v1/assets/:id/iot_alerts` | `api/v1/assets#iot_alerts` | Web app |
| GET | `/api/v1/assets/:id/iot_rules` | `api/v1/assets#iot_rules` | Web app |
| POST | `/api/v1/assets/:id/qr_code` | `api/v1/assets#qr_code` | Web app |
| GET | `/api/v1/assets/:id/sensor_readings` | `api/v1/assets#sensor_readings` | Web app |
| GET | `/api/v1/assets/:id/work_orders` | `api/v1/assets#work_orders` | Web app |
| GET | `/api/v1/assets/labels` | `api/v1/assets#labels` | Web app |
| GET | `/api/v1/assets/lookup` | `api/v1/assets#lookup` | Web app |

## auth

| Method | Path | Handled by | Stability |
| --- | --- | --- | --- |
| GET | `/api/v1/auth/directory` | `api/v1/auth/directory#show` | Web app |
| POST | `/api/v1/auth/directory` | `api/v1/auth/directory_sessions#create` | Web app |
| GET | `/api/v1/auth/me` | `api/v1/auth/profile#show` | Web app |
| GET | `/api/v1/auth/oidc/callback` | `api/v1/auth/directory#callback` | Web app |
| GET | `/api/v1/auth/oidc/start` | `api/v1/auth/directory#start` | Web app |
| PATCH, PUT | `/api/v1/auth/password` | `api/v1/auth/passwords#update` | Web app |
| POST | `/api/v1/auth/password` | `api/v1/auth/passwords#create` | Web app |
| GET | `/api/v1/auth/sign_in` | `api/v1/auth/sessions#new` | Web app |
| POST | `/api/v1/auth/sign_in` | `api/v1/auth/sessions#create` | Web app |
| DELETE | `/api/v1/auth/sign_out` | `api/v1/auth/sessions#destroy` | Web app |
| POST | `/api/v1/auth/sign_up` | `api/v1/auth/registrations#create` | Web app |
| POST | `/api/v1/auth/two_factor` | `api/v1/auth/two_factor_sessions#create` | Web app |

## backups

| Method | Path | Handled by | Stability |
| --- | --- | --- | --- |
| GET | `/api/v1/backups` | `api/v1/backups#index` | Web app |
| GET | `/api/v1/backups/:name/download` | `api/v1/backups#download` | Web app |

## branding

| Method | Path | Handled by | Stability |
| --- | --- | --- | --- |
| GET | `/api/v1/branding` | `api/v1/branding#show` | Web app |
| PATCH, PUT | `/api/v1/branding` | `api/v1/branding#update` | Web app |

## chat-settings

| Method | Path | Handled by | Stability |
| --- | --- | --- | --- |
| DELETE | `/api/v1/chat_settings` | `api/v1/chat_settings#destroy` | Web app |
| GET | `/api/v1/chat_settings` | `api/v1/chat_settings#show` | Web app |
| PATCH, PUT | `/api/v1/chat_settings` | `api/v1/chat_settings#update` | Web app |
| POST | `/api/v1/chat_settings/test` | `api/v1/chat_settings#test` | Web app |

## custom-fields

| Method | Path | Handled by | Stability |
| --- | --- | --- | --- |
| GET | `/api/v1/custom_fields` | `api/v1/custom_fields#index` | Web app |
| POST | `/api/v1/custom_fields` | `api/v1/custom_fields#create` | Web app |
| DELETE | `/api/v1/custom_fields/:id` | `api/v1/custom_fields#destroy` | Web app |
| PATCH, PUT | `/api/v1/custom_fields/:id` | `api/v1/custom_fields#update` | Web app |
| PATCH | `/api/v1/custom_fields/reorder` | `api/v1/custom_fields#reorder` | Web app |

## dashboard

| Method | Path | Handled by | Stability |
| --- | --- | --- | --- |
| GET | `/api/v1/dashboard` | `api/v1/dashboard#index` | Web app |

## data-usage

| Method | Path | Handled by | Stability |
| --- | --- | --- | --- |
| GET | `/api/v1/data_usage` | `api/v1/data_usage#show` | Web app |

## directory-settings

| Method | Path | Handled by | Stability |
| --- | --- | --- | --- |
| DELETE | `/api/v1/directory_settings` | `api/v1/directory_settings#destroy` | Web app |
| GET | `/api/v1/directory_settings` | `api/v1/directory_settings#show` | Web app |
| PATCH, PUT | `/api/v1/directory_settings` | `api/v1/directory_settings#update` | Web app |
| POST | `/api/v1/directory_settings/test` | `api/v1/directory_settings#test` | Web app |

## downtimes

| Method | Path | Handled by | Stability |
| --- | --- | --- | --- |
| DELETE | `/api/v1/downtimes/:id` | `api/v1/downtimes#destroy` | Web app |
| PATCH, PUT | `/api/v1/downtimes/:id` | `api/v1/downtimes#update` | Web app |
| POST | `/api/v1/downtimes/:id/restart` | `api/v1/downtimes#restart` | Web app |

## email-settings

| Method | Path | Handled by | Stability |
| --- | --- | --- | --- |
| DELETE | `/api/v1/email_settings` | `api/v1/email_settings#destroy` | Web app |
| GET | `/api/v1/email_settings` | `api/v1/email_settings#show` | Web app |
| PATCH, PUT | `/api/v1/email_settings` | `api/v1/email_settings#update` | Web app |
| POST | `/api/v1/email_settings/test` | `api/v1/email_settings#test` | Web app |

## getting-started

| Method | Path | Handled by | Stability |
| --- | --- | --- | --- |
| GET | `/api/v1/getting_started` | `api/v1/getting_started#show` | Web app |
| POST | `/api/v1/getting_started/dismiss` | `api/v1/getting_started#dismiss` | Web app |

## health

| Method | Path | Handled by | Stability |
| --- | --- | --- | --- |
| GET | `/api/v1/health` | `api/v1/health#show` | **Stable** |

## imports

| Method | Path | Handled by | Stability |
| --- | --- | --- | --- |
| POST | `/api/v1/imports/:kind` | `api/v1/imports#create` | Web app |
| POST | `/api/v1/imports/:kind/preview` | `api/v1/imports#preview` | Web app |
| GET | `/api/v1/imports/:kind/template` | `api/v1/imports#template` | Web app |

## invitations

| Method | Path | Handled by | Stability |
| --- | --- | --- | --- |
| GET | `/api/v1/invitations/:token` | `api/v1/invitations#show` | Web app |
| POST | `/api/v1/invitations/:token/accept` | `api/v1/invitations#accept` | Web app |

## iot

| Method | Path | Handled by | Stability |
| --- | --- | --- | --- |
| GET | `/api/v1/iot/assets/:id/latest` | `api/v1/iot#latest` | Web app |
| GET | `/api/v1/iot/assets/:id/readings` | `api/v1/iot#readings` | Web app |
| POST | `/api/v1/iot/ingest` | `api/v1/iot#ingest` | **Stable** |

## iot-alerts

| Method | Path | Handled by | Stability |
| --- | --- | --- | --- |
| GET | `/api/v1/iot_alerts` | `api/v1/iot_alerts#index` | Web app |
| GET | `/api/v1/iot_alerts/:id` | `api/v1/iot_alerts#show` | Web app |
| PATCH | `/api/v1/iot_alerts/:id/acknowledge` | `api/v1/iot_alerts#acknowledge` | Web app |
| PATCH | `/api/v1/iot_alerts/:id/resolve` | `api/v1/iot_alerts#resolve` | Web app |
| PATCH | `/api/v1/iot_alerts/:id/suppress` | `api/v1/iot_alerts#suppress` | Web app |
| PATCH | `/api/v1/iot_alerts/bulk_acknowledge` | `api/v1/iot_alerts#bulk_acknowledge` | Web app |
| PATCH | `/api/v1/iot_alerts/bulk_resolve` | `api/v1/iot_alerts#bulk_resolve` | Web app |

## iot-rules

| Method | Path | Handled by | Stability |
| --- | --- | --- | --- |
| GET | `/api/v1/iot_rules` | `api/v1/iot_rules#index` | Web app |
| POST | `/api/v1/iot_rules` | `api/v1/iot_rules#create` | Web app |
| DELETE | `/api/v1/iot_rules/:id` | `api/v1/iot_rules#destroy` | Web app |
| GET | `/api/v1/iot_rules/:id` | `api/v1/iot_rules#show` | Web app |
| PATCH, PUT | `/api/v1/iot_rules/:id` | `api/v1/iot_rules#update` | Web app |
| PATCH | `/api/v1/iot_rules/:id/archive` | `api/v1/iot_rules#archive` | Web app |
| POST | `/api/v1/iot_rules/:id/duplicate` | `api/v1/iot_rules#duplicate` | Web app |
| PATCH | `/api/v1/iot_rules/:id/pause` | `api/v1/iot_rules#pause` | Web app |
| PATCH | `/api/v1/iot_rules/:id/resume` | `api/v1/iot_rules#resume` | Web app |
| POST | `/api/v1/iot_rules/:id/test` | `api/v1/iot_rules#test` | Web app |

## localization-settings

| Method | Path | Handled by | Stability |
| --- | --- | --- | --- |
| GET | `/api/v1/localization_settings` | `api/v1/localization_settings#show` | Web app |
| PATCH, PUT | `/api/v1/localization_settings` | `api/v1/localization_settings#update` | Web app |

## locations

| Method | Path | Handled by | Stability |
| --- | --- | --- | --- |
| GET | `/api/v1/locations` | `api/v1/locations#index` | Web app |
| POST | `/api/v1/locations` | `api/v1/locations#create` | Web app |
| DELETE | `/api/v1/locations/:id` | `api/v1/locations#destroy` | Web app |
| GET | `/api/v1/locations/:id` | `api/v1/locations#show` | Web app |
| PATCH, PUT | `/api/v1/locations/:id` | `api/v1/locations#update` | Web app |
| GET | `/api/v1/locations/tree` | `api/v1/locations#tree` | Web app |

## meters

| Method | Path | Handled by | Stability |
| --- | --- | --- | --- |
| DELETE | `/api/v1/meters/:id` | `api/v1/meters#destroy` | Web app |
| PATCH, PUT | `/api/v1/meters/:id` | `api/v1/meters#update` | Web app |
| GET | `/api/v1/meters/:meter_id/readings` | `api/v1/meter_readings#index` | Web app |
| POST | `/api/v1/meters/:meter_id/readings` | `api/v1/meter_readings#create` | Web app |

## notification-preferences

| Method | Path | Handled by | Stability |
| --- | --- | --- | --- |
| GET | `/api/v1/notification_preferences` | `api/v1/notification_preferences#show` | Web app |
| PATCH, PUT | `/api/v1/notification_preferences` | `api/v1/notification_preferences#update` | Web app |

## open

| Method | Path | Handled by | Stability |
| --- | --- | --- | --- |
| GET | `/api/v1/open/assets` | `api/v1/open/assets#index` | **Stable** |
| POST | `/api/v1/open/assets` | `api/v1/open/assets#create` | **Stable** |
| GET | `/api/v1/open/assets/:id` | `api/v1/open/assets#show` | **Stable** |
| PATCH, PUT | `/api/v1/open/assets/:id` | `api/v1/open/assets#update` | **Stable** |
| GET | `/api/v1/open/locations` | `api/v1/open/locations#index` | **Stable** |
| GET | `/api/v1/open/locations/:id` | `api/v1/open/locations#show` | **Stable** |
| GET | `/api/v1/open/me` | `api/v1/open/me#show` | **Stable** |
| GET | `/api/v1/open/openapi` | `api/v1/open/openapi#show` | **Stable** |
| GET | `/api/v1/open/parts` | `api/v1/open/parts#index` | **Stable** |
| GET | `/api/v1/open/parts/:id` | `api/v1/open/parts#show` | **Stable** |
| GET | `/api/v1/open/work_orders` | `api/v1/open/work_orders#index` | **Stable** |
| POST | `/api/v1/open/work_orders` | `api/v1/open/work_orders#create` | **Stable** |
| GET | `/api/v1/open/work_orders/:id` | `api/v1/open/work_orders#show` | **Stable** |
| PATCH, PUT | `/api/v1/open/work_orders/:id` | `api/v1/open/work_orders#update` | **Stable** |
| POST | `/api/v1/open/work_orders/:id/transitions` | `api/v1/open/work_orders#transitions` | **Stable** |

## organization-settings

| Method | Path | Handled by | Stability |
| --- | --- | --- | --- |
| GET | `/api/v1/organization_settings` | `api/v1/organization_settings#show` | Web app |
| PATCH, PUT | `/api/v1/organization_settings` | `api/v1/organization_settings#update` | Web app |

## parts

| Method | Path | Handled by | Stability |
| --- | --- | --- | --- |
| GET | `/api/v1/parts` | `api/v1/parts#index` | Web app |
| POST | `/api/v1/parts` | `api/v1/parts#create` | Web app |
| DELETE | `/api/v1/parts/:id` | `api/v1/parts#destroy` | Web app |
| GET | `/api/v1/parts/:id` | `api/v1/parts#show` | Web app |
| PATCH, PUT | `/api/v1/parts/:id` | `api/v1/parts#update` | Web app |
| PATCH | `/api/v1/parts/:id/adjust_stock` | `api/v1/parts#adjust_stock` | Web app |
| GET | `/api/v1/parts/low_stock` | `api/v1/parts#low_stock` | Web app |

## plugin-reports

| Method | Path | Handled by | Stability |
| --- | --- | --- | --- |
| GET | `/api/v1/plugin_reports` | `api/v1/plugin_reports#index` | Web app |
| GET | `/api/v1/plugin_reports/:plugin/:report` | `api/v1/plugin_reports#show` | Web app |

## plugins

| Method | Path | Handled by | Stability |
| --- | --- | --- | --- |
| GET | `/api/v1/plugins` | `api/v1/plugins#index` | Web app |
| PATCH, PUT | `/api/v1/plugins/:key` | `api/v1/plugins#update` | Web app |
| DELETE | `/api/v1/plugins/:key/channels/:channel_key` | `api/v1/plugins#destroy_channel` | Web app |
| PUT | `/api/v1/plugins/:key/channels/:channel_key` | `api/v1/plugins#update_channel` | Web app |
| POST | `/api/v1/plugins/:key/channels/:channel_key/test` | `api/v1/plugins#test_channel` | Web app |

## preventive-maintenances

| Method | Path | Handled by | Stability |
| --- | --- | --- | --- |
| GET | `/api/v1/preventive_maintenances` | `api/v1/preventive_maintenances#index` | Web app |
| POST | `/api/v1/preventive_maintenances` | `api/v1/preventive_maintenances#create` | Web app |
| DELETE | `/api/v1/preventive_maintenances/:id` | `api/v1/preventive_maintenances#destroy` | Web app |
| GET | `/api/v1/preventive_maintenances/:id` | `api/v1/preventive_maintenances#show` | Web app |
| PATCH, PUT | `/api/v1/preventive_maintenances/:id` | `api/v1/preventive_maintenances#update` | Web app |
| PATCH | `/api/v1/preventive_maintenances/:id/pause` | `api/v1/preventive_maintenances#pause` | Web app |
| GET | `/api/v1/preventive_maintenances/:id/preview` | `api/v1/preventive_maintenances#preview` | Web app |
| PATCH | `/api/v1/preventive_maintenances/:id/resume` | `api/v1/preventive_maintenances#resume` | Web app |
| PATCH | `/api/v1/preventive_maintenances/:id/trigger` | `api/v1/preventive_maintenances#trigger` | Web app |
| GET | `/api/v1/preventive_maintenances/:preventive_maintenance_id/executions` | `api/v1/pm_executions#index` | Web app |
| PATCH | `/api/v1/preventive_maintenances/:preventive_maintenance_id/executions/:id/skip` | `api/v1/pm_executions#skip` | Web app |
| GET | `/api/v1/preventive_maintenances/dashboard` | `api/v1/preventive_maintenances#dashboard` | Web app |

## profile

| Method | Path | Handled by | Stability |
| --- | --- | --- | --- |
| GET | `/api/v1/profile` | `api/v1/profile#show` | Web app |
| PATCH, PUT | `/api/v1/profile` | `api/v1/profile#update` | Web app |
| PATCH | `/api/v1/profile/password` | `api/v1/profile#password` | Web app |
| DELETE | `/api/v1/profile/two_factor` | `api/v1/two_factor#destroy` | Web app |
| GET | `/api/v1/profile/two_factor` | `api/v1/two_factor#show` | Web app |
| POST | `/api/v1/profile/two_factor` | `api/v1/two_factor#create` | Web app |
| POST | `/api/v1/profile/two_factor/confirm` | `api/v1/two_factor#confirm` | Web app |
| POST | `/api/v1/profile/two_factor/recovery_codes` | `api/v1/two_factor#recovery_codes` | Web app |

## public-assets

| Method | Path | Handled by | Stability |
| --- | --- | --- | --- |
| GET | `/api/v1/public_assets/:code` | `api/v1/work_requests#asset` | Web app |

## public-request-form

| Method | Path | Handled by | Stability |
| --- | --- | --- | --- |
| GET | `/api/v1/public_request_form` | `api/v1/work_requests#form` | Web app |

## purchase-orders

| Method | Path | Handled by | Stability |
| --- | --- | --- | --- |
| GET | `/api/v1/purchase_orders` | `api/v1/purchase_orders#index` | Web app |
| POST | `/api/v1/purchase_orders` | `api/v1/purchase_orders#create` | Web app |
| GET | `/api/v1/purchase_orders/:id` | `api/v1/purchase_orders#show` | Web app |
| PATCH, PUT | `/api/v1/purchase_orders/:id` | `api/v1/purchase_orders#update` | Web app |
| POST | `/api/v1/purchase_orders/:id/approve` | `api/v1/purchase_orders#approve` | Web app |
| POST | `/api/v1/purchase_orders/:id/cancel` | `api/v1/purchase_orders#cancel` | Web app |
| POST | `/api/v1/purchase_orders/:id/close` | `api/v1/purchase_orders#close` | Web app |
| POST | `/api/v1/purchase_orders/:id/order` | `api/v1/purchase_orders#order` | Web app |
| POST | `/api/v1/purchase_orders/:id/receive` | `api/v1/purchase_orders#receive` | Web app |
| POST | `/api/v1/purchase_orders/:id/reject` | `api/v1/purchase_orders#reject` | Web app |

## push-subscriptions

| Method | Path | Handled by | Stability |
| --- | --- | --- | --- |
| DELETE | `/api/v1/push_subscriptions` | `api/v1/push_subscriptions#destroy` | Web app |
| GET | `/api/v1/push_subscriptions` | `api/v1/push_subscriptions#index` | Web app |
| POST | `/api/v1/push_subscriptions` | `api/v1/push_subscriptions#create` | Web app |
| POST | `/api/v1/push_subscriptions/test` | `api/v1/push_subscriptions#test` | Web app |

## reports

| Method | Path | Handled by | Stability |
| --- | --- | --- | --- |
| GET | `/api/v1/reports/assets/:id/history` | `api/v1/reports/assets#history` | Web app |
| GET | `/api/v1/reports/assets/cost_analysis` | `api/v1/reports/assets#cost_analysis` | Web app |
| GET | `/api/v1/reports/assets/downtime` | `api/v1/reports/assets#downtime` | Web app |
| GET | `/api/v1/reports/assets/health` | `api/v1/reports/assets#health` | Web app |
| GET | `/api/v1/reports/costs/by_asset` | `api/v1/reports/costs#by_asset` | Web app |
| GET | `/api/v1/reports/costs/by_location` | `api/v1/reports/costs#by_location` | Web app |
| GET | `/api/v1/reports/costs/by_vendor` | `api/v1/reports/costs#by_vendor` | Web app |
| GET | `/api/v1/reports/costs/summary` | `api/v1/reports/costs#summary` | Web app |
| GET | `/api/v1/reports/iot/alert_summary` | `api/v1/reports/iot#alert_summary` | Web app |
| GET | `/api/v1/reports/iot/alerts` | `api/v1/reports/iot#alerts` | Web app |
| GET | `/api/v1/reports/iot/dashboard` | `api/v1/reports/iot#dashboard` | Web app |
| GET | `/api/v1/reports/iot/rule_effectiveness` | `api/v1/reports/iot#rule_effectiveness` | Web app |
| GET | `/api/v1/reports/iot/sensor_trends` | `api/v1/reports/iot#sensor_trends` | Web app |
| GET | `/api/v1/reports/pm/compliance` | `api/v1/reports/pm#compliance` | Web app |
| GET | `/api/v1/reports/pm/schedule_forecast` | `api/v1/reports/pm#schedule_forecast` | Web app |
| GET | `/api/v1/reports/sites` | `api/v1/reports/sites#show` | Web app |
| GET | `/api/v1/reports/work_orders/backlog` | `api/v1/reports/work_orders#backlog` | Web app |
| GET | `/api/v1/reports/work_orders/mttr` | `api/v1/reports/work_orders#mttr` | Web app |
| GET | `/api/v1/reports/work_orders/summary` | `api/v1/reports/work_orders#summary` | Web app |
| GET | `/api/v1/reports/work_orders/technician_performance` | `api/v1/reports/work_orders#technician_performance` | Web app |

## sample-data

| Method | Path | Handled by | Stability |
| --- | --- | --- | --- |
| DELETE | `/api/v1/sample_data` | `api/v1/sample_data#destroy` | Web app |
| GET | `/api/v1/sample_data` | `api/v1/sample_data#show` | Web app |
| POST | `/api/v1/sample_data` | `api/v1/sample_data#create` | Web app |

## saved-reports

| Method | Path | Handled by | Stability |
| --- | --- | --- | --- |
| GET | `/api/v1/saved_reports` | `api/v1/saved_reports#index` | Web app |
| POST | `/api/v1/saved_reports` | `api/v1/saved_reports#create` | Web app |
| DELETE | `/api/v1/saved_reports/:id` | `api/v1/saved_reports#destroy` | Web app |
| PATCH, PUT | `/api/v1/saved_reports/:id` | `api/v1/saved_reports#update` | Web app |
| POST | `/api/v1/saved_reports/:id/send_now` | `api/v1/saved_reports#send_now` | Web app |

## schedule

| Method | Path | Handled by | Stability |
| --- | --- | --- | --- |
| GET | `/api/v1/schedule` | `api/v1/schedules#show` | Web app |

## sensor-anomalies

| Method | Path | Handled by | Stability |
| --- | --- | --- | --- |
| GET | `/api/v1/sensor_anomalies` | `api/v1/sensor_anomalies#index` | Web app |
| PATCH | `/api/v1/sensor_anomalies/:id/acknowledge` | `api/v1/sensor_anomalies#acknowledge` | Web app |
| PATCH | `/api/v1/sensor_anomalies/:id/dismiss` | `api/v1/sensor_anomalies#dismiss` | Web app |

## sessions

| Method | Path | Handled by | Stability |
| --- | --- | --- | --- |
| GET | `/api/v1/sessions` | `api/v1/user_sessions#index` | Web app |
| DELETE | `/api/v1/sessions/:id` | `api/v1/user_sessions#destroy` | Web app |
| DELETE | `/api/v1/sessions/all` | `api/v1/user_sessions#destroy_all` | Web app |

## setup

| Method | Path | Handled by | Stability |
| --- | --- | --- | --- |
| GET | `/api/v1/setup/status` | `api/v1/setup#status` | Web app |

## sites

| Method | Path | Handled by | Stability |
| --- | --- | --- | --- |
| GET | `/api/v1/sites` | `api/v1/sites#index` | Web app |
| POST | `/api/v1/sites` | `api/v1/sites#create` | Web app |
| PATCH, PUT | `/api/v1/sites/:id` | `api/v1/sites#update` | Web app |
| PUT | `/api/v1/sites/:id/people` | `api/v1/sites#people` | Web app |
| PUT | `/api/v1/sites/enabled` | `api/v1/sites#enabled` | Web app |

## storage

| Method | Path | Handled by | Stability |
| --- | --- | --- | --- |
| GET | `/api/v1/storage/blobs/:signed_id/*filename` | `active_storage/blobs/redirect#show` | Web app |
| GET | `/api/v1/storage/blobs/proxy/:signed_id/*filename` | `active_storage/blobs/proxy#show` | Web app |
| GET | `/api/v1/storage/blobs/redirect/:signed_id/*filename` | `active_storage/blobs/redirect#show` | Web app |
| POST | `/api/v1/storage/direct_uploads` | `active_storage/direct_uploads#create` | Web app |
| GET | `/api/v1/storage/disk/:encoded_key/*filename` | `active_storage/disk#show` | Web app |
| PUT | `/api/v1/storage/disk/:encoded_token` | `active_storage/disk#update` | Web app |
| GET | `/api/v1/storage/representations/:signed_blob_id/:variation_key/*filename` | `active_storage/representations/redirect#show` | Web app |
| GET | `/api/v1/storage/representations/proxy/:signed_blob_id/:variation_key/*filename` | `active_storage/representations/proxy#show` | Web app |
| GET | `/api/v1/storage/representations/redirect/:signed_blob_id/:variation_key/*filename` | `active_storage/representations/redirect#show` | Web app |

## system-health

| Method | Path | Handled by | Stability |
| --- | --- | --- | --- |
| GET | `/api/v1/system_health` | `api/v1/system_health#show` | Web app |

## users

| Method | Path | Handled by | Stability |
| --- | --- | --- | --- |
| GET | `/api/v1/users` | `api/v1/users#index` | Web app |
| DELETE | `/api/v1/users/:id` | `api/v1/users#destroy` | Web app |
| GET | `/api/v1/users/:id` | `api/v1/users#show` | Web app |
| PATCH, PUT | `/api/v1/users/:id` | `api/v1/users#update` | Web app |
| PATCH | `/api/v1/users/:id/deactivate` | `api/v1/users#deactivate` | Web app |
| PATCH | `/api/v1/users/:id/reactivate` | `api/v1/users#reactivate` | Web app |
| POST | `/api/v1/users/:id/resend_invitation` | `api/v1/users#resend_invitation` | Web app |
| POST | `/api/v1/users/:id/reset_password` | `api/v1/users#reset_password` | Web app |
| POST | `/api/v1/users/:id/reset_two_factor` | `api/v1/users#reset_two_factor` | Web app |
| PATCH | `/api/v1/users/:id/role` | `api/v1/users#role` | Web app |
| POST | `/api/v1/users/:id/unlock` | `api/v1/users#unlock` | Web app |
| PATCH | `/api/v1/users/bulk_deactivate` | `api/v1/users#bulk_deactivate` | Web app |
| PATCH | `/api/v1/users/bulk_role` | `api/v1/users#bulk_role` | Web app |
| POST | `/api/v1/users/invite` | `api/v1/users#invite` | Web app |
| GET | `/api/v1/users/me` | `api/v1/users#me` | Web app |

## vendors

| Method | Path | Handled by | Stability |
| --- | --- | --- | --- |
| GET | `/api/v1/vendors` | `api/v1/vendors#index` | Web app |
| POST | `/api/v1/vendors` | `api/v1/vendors#create` | Web app |
| DELETE | `/api/v1/vendors/:id` | `api/v1/vendors#destroy` | Web app |
| GET | `/api/v1/vendors/:id` | `api/v1/vendors#show` | Web app |
| PATCH, PUT | `/api/v1/vendors/:id` | `api/v1/vendors#update` | Web app |
| POST | `/api/v1/vendors/:vendor_id/contacts` | `api/v1/vendor_contacts#create` | Web app |
| DELETE | `/api/v1/vendors/:vendor_id/contacts/:id` | `api/v1/vendor_contacts#destroy` | Web app |
| PATCH, PUT | `/api/v1/vendors/:vendor_id/contacts/:id` | `api/v1/vendor_contacts#update` | Web app |

## webhooks

| Method | Path | Handled by | Stability |
| --- | --- | --- | --- |
| GET | `/api/v1/webhooks` | `api/v1/webhooks#index` | Web app |
| POST | `/api/v1/webhooks` | `api/v1/webhooks#create` | Web app |
| DELETE | `/api/v1/webhooks/:id` | `api/v1/webhooks#destroy` | Web app |
| GET | `/api/v1/webhooks/:id` | `api/v1/webhooks#show` | Web app |
| PATCH, PUT | `/api/v1/webhooks/:id` | `api/v1/webhooks#update` | Web app |
| POST | `/api/v1/webhooks/:id/enable` | `api/v1/webhooks#enable` | Web app |
| POST | `/api/v1/webhooks/:id/rotate_secret` | `api/v1/webhooks#rotate_secret` | Web app |
| POST | `/api/v1/webhooks/:id/test` | `api/v1/webhooks#test` | Web app |
| POST | `/api/v1/webhooks/deliveries/:id/redeliver` | `api/v1/webhooks#redeliver` | Web app |

## work-orders

| Method | Path | Handled by | Stability |
| --- | --- | --- | --- |
| GET | `/api/v1/work_orders` | `api/v1/work_orders#index` | Web app |
| POST | `/api/v1/work_orders` | `api/v1/work_orders#create` | Web app |
| DELETE | `/api/v1/work_orders/:id` | `api/v1/work_orders#destroy` | Web app |
| GET | `/api/v1/work_orders/:id` | `api/v1/work_orders#show` | Web app |
| PATCH, PUT | `/api/v1/work_orders/:id` | `api/v1/work_orders#update` | Web app |
| PATCH | `/api/v1/work_orders/:id/approve` | `api/v1/work_orders#approve` | Web app |
| PATCH | `/api/v1/work_orders/:id/assign` | `api/v1/work_orders#assign` | Web app |
| PATCH | `/api/v1/work_orders/:id/cancel` | `api/v1/work_orders#cancel` | Web app |
| PATCH | `/api/v1/work_orders/:id/complete` | `api/v1/work_orders#complete` | Web app |
| PATCH | `/api/v1/work_orders/:id/hold` | `api/v1/work_orders#hold` | Web app |
| PATCH | `/api/v1/work_orders/:id/reject` | `api/v1/work_orders#reject` | Web app |
| PATCH | `/api/v1/work_orders/:id/request_approval` | `api/v1/work_orders#request_approval` | Web app |
| PATCH | `/api/v1/work_orders/:id/reschedule` | `api/v1/work_orders#reschedule` | Web app |
| PATCH | `/api/v1/work_orders/:id/start` | `api/v1/work_orders#start` | Web app |
| PATCH | `/api/v1/work_orders/:id/transition` | `api/v1/work_orders#transition` | Web app |
| PATCH | `/api/v1/work_orders/:id/verify` | `api/v1/work_orders#verify` | Web app |
| GET | `/api/v1/work_orders/:work_order_id/attachments` | `api/v1/attachments#index` | Web app |
| POST | `/api/v1/work_orders/:work_order_id/attachments` | `api/v1/attachments#create` | Web app |
| DELETE | `/api/v1/work_orders/:work_order_id/attachments/:id` | `api/v1/attachments#destroy` | Web app |
| GET | `/api/v1/work_orders/:work_order_id/comments` | `api/v1/comments#index` | Web app |
| POST | `/api/v1/work_orders/:work_order_id/comments` | `api/v1/comments#create` | Web app |
| DELETE | `/api/v1/work_orders/:work_order_id/comments/:id` | `api/v1/comments#destroy` | Web app |
| GET | `/api/v1/work_orders/:work_order_id/parts` | `api/v1/work_order_parts#index` | Web app |
| POST | `/api/v1/work_orders/:work_order_id/parts` | `api/v1/work_order_parts#create` | Web app |
| DELETE | `/api/v1/work_orders/:work_order_id/parts/:id` | `api/v1/work_order_parts#destroy` | Web app |
| GET | `/api/v1/work_orders/overdue` | `api/v1/work_orders#overdue` | Web app |
| GET | `/api/v1/work_orders/unassigned` | `api/v1/work_orders#unassigned` | Web app |

## work-requests

| Method | Path | Handled by | Stability |
| --- | --- | --- | --- |
| POST | `/api/v1/work_requests` | `api/v1/work_requests#create` | Web app |
| GET | `/api/v1/work_requests/:token` | `api/v1/work_requests#show` | Web app |
