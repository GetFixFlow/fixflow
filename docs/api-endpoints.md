# API endpoints

Every endpoint of the API, written from the server's routes by `rails docs:api` (do not edit this page by hand).
How to sign in, what answers look like and what the limits are is on the [API](api.md) page. In the paths, `:id` and
the like stand for a value, and `:format` is left out. Live updates are a WebSocket at `/cable`. The `auth` group also
holds the standard routes of the sign-in library that nothing uses (`sign_up/edit` and the like): the ones to use are
`sign_in`, `sign_out`, `two_factor`, `password` and `me`; `sign_up` works only until the first company exists.

There are 192 endpoints in 37 groups: [activity_logs](#activity-logs), [ai](#ai), [api_keys](#api-keys), [assets](#assets), [auth](#auth), [backups](#backups), [branding](#branding), [chat_settings](#chat-settings), [dashboard](#dashboard), [data_usage](#data-usage), [email_settings](#email-settings), [getting_started](#getting-started), [health](#health), [imports](#imports), [invitations](#invitations), [iot](#iot), [iot_alerts](#iot-alerts), [iot_rules](#iot-rules), [localization_settings](#localization-settings), [locations](#locations), [notification_preferences](#notification-preferences), [organization_settings](#organization-settings), [parts](#parts), [preventive_maintenances](#preventive-maintenances), [profile](#profile), [public_assets](#public-assets), [public_request_form](#public-request-form), [push_subscriptions](#push-subscriptions), [reports](#reports), [sample_data](#sample-data), [sessions](#sessions), [setup](#setup), [storage](#storage), [system_health](#system-health), [users](#users), [work_orders](#work-orders), [work_requests](#work-requests).

## activity-logs

| Method | Path | Handled by |
| --- | --- | --- |
| GET | `/api/v1/activity_logs` | `api/v1/activity_logs#index` |

## ai

| Method | Path | Handled by |
| --- | --- | --- |
| POST | `/api/v1/ai/assist` | `api/v1/ai/assist#create` |
| GET | `/api/v1/ai/config` | `api/v1/ai/config#show` |

## api-keys

| Method | Path | Handled by |
| --- | --- | --- |
| GET | `/api/v1/api_keys` | `api/v1/api_keys#index` |
| POST | `/api/v1/api_keys` | `api/v1/api_keys#create` |
| DELETE | `/api/v1/api_keys/:id` | `api/v1/api_keys#destroy` |

## assets

| Method | Path | Handled by |
| --- | --- | --- |
| GET | `/api/v1/assets` | `api/v1/assets#index` |
| POST | `/api/v1/assets` | `api/v1/assets#create` |
| DELETE | `/api/v1/assets/:id` | `api/v1/assets#destroy` |
| GET | `/api/v1/assets/:id` | `api/v1/assets#show` |
| PATCH, PUT | `/api/v1/assets/:id` | `api/v1/assets#update` |
| GET | `/api/v1/assets/:id/history` | `api/v1/assets#history` |
| GET | `/api/v1/assets/:id/iot_alerts` | `api/v1/assets#iot_alerts` |
| GET | `/api/v1/assets/:id/iot_rules` | `api/v1/assets#iot_rules` |
| POST | `/api/v1/assets/:id/qr_code` | `api/v1/assets#qr_code` |
| GET | `/api/v1/assets/:id/sensor_readings` | `api/v1/assets#sensor_readings` |
| GET | `/api/v1/assets/:id/work_orders` | `api/v1/assets#work_orders` |

## auth

| Method | Path | Handled by |
| --- | --- | --- |
| GET | `/api/v1/auth/me` | `api/v1/auth/profile#show` |
| PATCH, PUT | `/api/v1/auth/password` | `api/v1/auth/passwords#update` |
| POST | `/api/v1/auth/password` | `api/v1/auth/passwords#create` |
| GET | `/api/v1/auth/sign_in` | `api/v1/auth/sessions#new` |
| POST | `/api/v1/auth/sign_in` | `api/v1/auth/sessions#create` |
| DELETE | `/api/v1/auth/sign_out` | `api/v1/auth/sessions#destroy` |
| DELETE | `/api/v1/auth/sign_up` | `api/v1/auth/registrations#destroy` |
| PATCH, PUT | `/api/v1/auth/sign_up` | `api/v1/auth/registrations#update` |
| POST | `/api/v1/auth/sign_up` | `api/v1/auth/registrations#create` |
| GET | `/api/v1/auth/sign_up/cancel` | `api/v1/auth/registrations#cancel` |
| GET | `/api/v1/auth/sign_up/edit` | `api/v1/auth/registrations#edit` |
| GET | `/api/v1/auth/sign_up/sign_up` | `api/v1/auth/registrations#new` |
| POST | `/api/v1/auth/two_factor` | `api/v1/auth/two_factor_sessions#create` |

## backups

| Method | Path | Handled by |
| --- | --- | --- |
| GET | `/api/v1/backups` | `api/v1/backups#index` |
| GET | `/api/v1/backups/:name/download` | `api/v1/backups#download` |

## branding

| Method | Path | Handled by |
| --- | --- | --- |
| GET | `/api/v1/branding` | `api/v1/branding#show` |
| PATCH, PUT | `/api/v1/branding` | `api/v1/branding#update` |

## chat-settings

| Method | Path | Handled by |
| --- | --- | --- |
| DELETE | `/api/v1/chat_settings` | `api/v1/chat_settings#destroy` |
| GET | `/api/v1/chat_settings` | `api/v1/chat_settings#show` |
| PATCH, PUT | `/api/v1/chat_settings` | `api/v1/chat_settings#update` |
| POST | `/api/v1/chat_settings/test` | `api/v1/chat_settings#test` |

## dashboard

| Method | Path | Handled by |
| --- | --- | --- |
| GET | `/api/v1/dashboard` | `api/v1/dashboard#index` |

## data-usage

| Method | Path | Handled by |
| --- | --- | --- |
| GET | `/api/v1/data_usage` | `api/v1/data_usage#show` |

## email-settings

| Method | Path | Handled by |
| --- | --- | --- |
| DELETE | `/api/v1/email_settings` | `api/v1/email_settings#destroy` |
| GET | `/api/v1/email_settings` | `api/v1/email_settings#show` |
| PATCH, PUT | `/api/v1/email_settings` | `api/v1/email_settings#update` |
| POST | `/api/v1/email_settings/test` | `api/v1/email_settings#test` |

## getting-started

| Method | Path | Handled by |
| --- | --- | --- |
| GET | `/api/v1/getting_started` | `api/v1/getting_started#show` |
| POST | `/api/v1/getting_started/dismiss` | `api/v1/getting_started#dismiss` |

## health

| Method | Path | Handled by |
| --- | --- | --- |
| GET | `/api/v1/health` | `api/v1/health#show` |

## imports

| Method | Path | Handled by |
| --- | --- | --- |
| POST | `/api/v1/imports/:kind` | `api/v1/imports#create` |
| POST | `/api/v1/imports/:kind/preview` | `api/v1/imports#preview` |
| GET | `/api/v1/imports/:kind/template` | `api/v1/imports#template` |

## invitations

| Method | Path | Handled by |
| --- | --- | --- |
| GET | `/api/v1/invitations/:token` | `api/v1/invitations#show` |
| POST | `/api/v1/invitations/:token/accept` | `api/v1/invitations#accept` |

## iot

| Method | Path | Handled by |
| --- | --- | --- |
| GET | `/api/v1/iot/assets/:id/latest` | `api/v1/iot#latest` |
| GET | `/api/v1/iot/assets/:id/readings` | `api/v1/iot#readings` |
| POST | `/api/v1/iot/ingest` | `api/v1/iot#ingest` |

## iot-alerts

| Method | Path | Handled by |
| --- | --- | --- |
| GET | `/api/v1/iot_alerts` | `api/v1/iot_alerts#index` |
| GET | `/api/v1/iot_alerts/:id` | `api/v1/iot_alerts#show` |
| PATCH | `/api/v1/iot_alerts/:id/acknowledge` | `api/v1/iot_alerts#acknowledge` |
| PATCH | `/api/v1/iot_alerts/:id/resolve` | `api/v1/iot_alerts#resolve` |
| PATCH | `/api/v1/iot_alerts/:id/suppress` | `api/v1/iot_alerts#suppress` |
| PATCH | `/api/v1/iot_alerts/bulk_acknowledge` | `api/v1/iot_alerts#bulk_acknowledge` |
| PATCH | `/api/v1/iot_alerts/bulk_resolve` | `api/v1/iot_alerts#bulk_resolve` |

## iot-rules

| Method | Path | Handled by |
| --- | --- | --- |
| GET | `/api/v1/iot_rules` | `api/v1/iot_rules#index` |
| POST | `/api/v1/iot_rules` | `api/v1/iot_rules#create` |
| DELETE | `/api/v1/iot_rules/:id` | `api/v1/iot_rules#destroy` |
| GET | `/api/v1/iot_rules/:id` | `api/v1/iot_rules#show` |
| PATCH, PUT | `/api/v1/iot_rules/:id` | `api/v1/iot_rules#update` |
| PATCH | `/api/v1/iot_rules/:id/archive` | `api/v1/iot_rules#archive` |
| POST | `/api/v1/iot_rules/:id/duplicate` | `api/v1/iot_rules#duplicate` |
| PATCH | `/api/v1/iot_rules/:id/pause` | `api/v1/iot_rules#pause` |
| PATCH | `/api/v1/iot_rules/:id/resume` | `api/v1/iot_rules#resume` |
| POST | `/api/v1/iot_rules/:id/test` | `api/v1/iot_rules#test` |

## localization-settings

| Method | Path | Handled by |
| --- | --- | --- |
| GET | `/api/v1/localization_settings` | `api/v1/localization_settings#show` |
| PATCH, PUT | `/api/v1/localization_settings` | `api/v1/localization_settings#update` |

## locations

| Method | Path | Handled by |
| --- | --- | --- |
| GET | `/api/v1/locations` | `api/v1/locations#index` |
| POST | `/api/v1/locations` | `api/v1/locations#create` |
| DELETE | `/api/v1/locations/:id` | `api/v1/locations#destroy` |
| GET | `/api/v1/locations/:id` | `api/v1/locations#show` |
| PATCH, PUT | `/api/v1/locations/:id` | `api/v1/locations#update` |
| GET | `/api/v1/locations/tree` | `api/v1/locations#tree` |

## notification-preferences

| Method | Path | Handled by |
| --- | --- | --- |
| GET | `/api/v1/notification_preferences` | `api/v1/notification_preferences#show` |
| PATCH, PUT | `/api/v1/notification_preferences` | `api/v1/notification_preferences#update` |

## organization-settings

| Method | Path | Handled by |
| --- | --- | --- |
| GET | `/api/v1/organization_settings` | `api/v1/organization_settings#show` |
| PATCH, PUT | `/api/v1/organization_settings` | `api/v1/organization_settings#update` |

## parts

| Method | Path | Handled by |
| --- | --- | --- |
| GET | `/api/v1/parts` | `api/v1/parts#index` |
| POST | `/api/v1/parts` | `api/v1/parts#create` |
| DELETE | `/api/v1/parts/:id` | `api/v1/parts#destroy` |
| GET | `/api/v1/parts/:id` | `api/v1/parts#show` |
| PATCH, PUT | `/api/v1/parts/:id` | `api/v1/parts#update` |
| PATCH | `/api/v1/parts/:id/adjust_stock` | `api/v1/parts#adjust_stock` |
| GET | `/api/v1/parts/low_stock` | `api/v1/parts#low_stock` |

## preventive-maintenances

| Method | Path | Handled by |
| --- | --- | --- |
| GET | `/api/v1/preventive_maintenances` | `api/v1/preventive_maintenances#index` |
| POST | `/api/v1/preventive_maintenances` | `api/v1/preventive_maintenances#create` |
| DELETE | `/api/v1/preventive_maintenances/:id` | `api/v1/preventive_maintenances#destroy` |
| GET | `/api/v1/preventive_maintenances/:id` | `api/v1/preventive_maintenances#show` |
| PATCH, PUT | `/api/v1/preventive_maintenances/:id` | `api/v1/preventive_maintenances#update` |
| PATCH | `/api/v1/preventive_maintenances/:id/pause` | `api/v1/preventive_maintenances#pause` |
| GET | `/api/v1/preventive_maintenances/:id/preview` | `api/v1/preventive_maintenances#preview` |
| PATCH | `/api/v1/preventive_maintenances/:id/resume` | `api/v1/preventive_maintenances#resume` |
| PATCH | `/api/v1/preventive_maintenances/:id/trigger` | `api/v1/preventive_maintenances#trigger` |
| GET | `/api/v1/preventive_maintenances/:preventive_maintenance_id/executions` | `api/v1/pm_executions#index` |
| PATCH | `/api/v1/preventive_maintenances/:preventive_maintenance_id/executions/:id/skip` | `api/v1/pm_executions#skip` |
| GET | `/api/v1/preventive_maintenances/dashboard` | `api/v1/preventive_maintenances#dashboard` |

## profile

| Method | Path | Handled by |
| --- | --- | --- |
| GET | `/api/v1/profile` | `api/v1/profile#show` |
| PATCH, PUT | `/api/v1/profile` | `api/v1/profile#update` |
| PATCH | `/api/v1/profile/password` | `api/v1/profile#password` |
| DELETE | `/api/v1/profile/two_factor` | `api/v1/two_factor#destroy` |
| GET | `/api/v1/profile/two_factor` | `api/v1/two_factor#show` |
| POST | `/api/v1/profile/two_factor` | `api/v1/two_factor#create` |
| POST | `/api/v1/profile/two_factor/confirm` | `api/v1/two_factor#confirm` |
| POST | `/api/v1/profile/two_factor/recovery_codes` | `api/v1/two_factor#recovery_codes` |

## public-assets

| Method | Path | Handled by |
| --- | --- | --- |
| GET | `/api/v1/public_assets/:code` | `api/v1/work_requests#asset` |

## public-request-form

| Method | Path | Handled by |
| --- | --- | --- |
| GET | `/api/v1/public_request_form` | `api/v1/work_requests#form` |

## push-subscriptions

| Method | Path | Handled by |
| --- | --- | --- |
| DELETE | `/api/v1/push_subscriptions` | `api/v1/push_subscriptions#destroy` |
| GET | `/api/v1/push_subscriptions` | `api/v1/push_subscriptions#index` |
| POST | `/api/v1/push_subscriptions` | `api/v1/push_subscriptions#create` |
| POST | `/api/v1/push_subscriptions/test` | `api/v1/push_subscriptions#test` |

## reports

| Method | Path | Handled by |
| --- | --- | --- |
| GET | `/api/v1/reports/assets/:id/history` | `api/v1/reports/assets#history` |
| GET | `/api/v1/reports/assets/cost_analysis` | `api/v1/reports/assets#cost_analysis` |
| GET | `/api/v1/reports/assets/health` | `api/v1/reports/assets#health` |
| GET | `/api/v1/reports/costs/by_asset` | `api/v1/reports/costs#by_asset` |
| GET | `/api/v1/reports/costs/by_location` | `api/v1/reports/costs#by_location` |
| GET | `/api/v1/reports/costs/summary` | `api/v1/reports/costs#summary` |
| GET | `/api/v1/reports/iot/alert_summary` | `api/v1/reports/iot#alert_summary` |
| GET | `/api/v1/reports/iot/alerts` | `api/v1/reports/iot#alerts` |
| GET | `/api/v1/reports/iot/dashboard` | `api/v1/reports/iot#dashboard` |
| GET | `/api/v1/reports/iot/rule_effectiveness` | `api/v1/reports/iot#rule_effectiveness` |
| GET | `/api/v1/reports/iot/sensor_trends` | `api/v1/reports/iot#sensor_trends` |
| GET | `/api/v1/reports/pm/compliance` | `api/v1/reports/pm#compliance` |
| GET | `/api/v1/reports/pm/schedule_forecast` | `api/v1/reports/pm#schedule_forecast` |
| GET | `/api/v1/reports/work_orders/backlog` | `api/v1/reports/work_orders#backlog` |
| GET | `/api/v1/reports/work_orders/mttr` | `api/v1/reports/work_orders#mttr` |
| GET | `/api/v1/reports/work_orders/summary` | `api/v1/reports/work_orders#summary` |
| GET | `/api/v1/reports/work_orders/technician_performance` | `api/v1/reports/work_orders#technician_performance` |

## sample-data

| Method | Path | Handled by |
| --- | --- | --- |
| DELETE | `/api/v1/sample_data` | `api/v1/sample_data#destroy` |
| GET | `/api/v1/sample_data` | `api/v1/sample_data#show` |
| POST | `/api/v1/sample_data` | `api/v1/sample_data#create` |

## sessions

| Method | Path | Handled by |
| --- | --- | --- |
| GET | `/api/v1/sessions` | `api/v1/user_sessions#index` |
| DELETE | `/api/v1/sessions/:id` | `api/v1/user_sessions#destroy` |
| DELETE | `/api/v1/sessions/all` | `api/v1/user_sessions#destroy_all` |

## setup

| Method | Path | Handled by |
| --- | --- | --- |
| GET | `/api/v1/setup/status` | `api/v1/setup#status` |

## storage

| Method | Path | Handled by |
| --- | --- | --- |
| GET | `/api/v1/storage/blobs/:signed_id/*filename` | `active_storage/blobs/redirect#show` |
| GET | `/api/v1/storage/blobs/proxy/:signed_id/*filename` | `active_storage/blobs/proxy#show` |
| GET | `/api/v1/storage/blobs/redirect/:signed_id/*filename` | `active_storage/blobs/redirect#show` |
| POST | `/api/v1/storage/direct_uploads` | `active_storage/direct_uploads#create` |
| GET | `/api/v1/storage/disk/:encoded_key/*filename` | `active_storage/disk#show` |
| PUT | `/api/v1/storage/disk/:encoded_token` | `active_storage/disk#update` |
| GET | `/api/v1/storage/representations/:signed_blob_id/:variation_key/*filename` | `active_storage/representations/redirect#show` |
| GET | `/api/v1/storage/representations/proxy/:signed_blob_id/:variation_key/*filename` | `active_storage/representations/proxy#show` |
| GET | `/api/v1/storage/representations/redirect/:signed_blob_id/:variation_key/*filename` | `active_storage/representations/redirect#show` |

## system-health

| Method | Path | Handled by |
| --- | --- | --- |
| GET | `/api/v1/system_health` | `api/v1/system_health#show` |

## users

| Method | Path | Handled by |
| --- | --- | --- |
| GET | `/api/v1/users` | `api/v1/users#index` |
| DELETE | `/api/v1/users/:id` | `api/v1/users#destroy` |
| GET | `/api/v1/users/:id` | `api/v1/users#show` |
| PATCH, PUT | `/api/v1/users/:id` | `api/v1/users#update` |
| PATCH | `/api/v1/users/:id/deactivate` | `api/v1/users#deactivate` |
| PATCH | `/api/v1/users/:id/reactivate` | `api/v1/users#reactivate` |
| POST | `/api/v1/users/:id/resend_invitation` | `api/v1/users#resend_invitation` |
| POST | `/api/v1/users/:id/reset_password` | `api/v1/users#reset_password` |
| POST | `/api/v1/users/:id/reset_two_factor` | `api/v1/users#reset_two_factor` |
| PATCH | `/api/v1/users/:id/role` | `api/v1/users#role` |
| POST | `/api/v1/users/:id/unlock` | `api/v1/users#unlock` |
| PATCH | `/api/v1/users/bulk_deactivate` | `api/v1/users#bulk_deactivate` |
| PATCH | `/api/v1/users/bulk_role` | `api/v1/users#bulk_role` |
| POST | `/api/v1/users/invite` | `api/v1/users#invite` |
| GET | `/api/v1/users/me` | `api/v1/users#me` |

## work-orders

| Method | Path | Handled by |
| --- | --- | --- |
| GET | `/api/v1/work_orders` | `api/v1/work_orders#index` |
| POST | `/api/v1/work_orders` | `api/v1/work_orders#create` |
| DELETE | `/api/v1/work_orders/:id` | `api/v1/work_orders#destroy` |
| GET | `/api/v1/work_orders/:id` | `api/v1/work_orders#show` |
| PATCH, PUT | `/api/v1/work_orders/:id` | `api/v1/work_orders#update` |
| PATCH | `/api/v1/work_orders/:id/assign` | `api/v1/work_orders#assign` |
| PATCH | `/api/v1/work_orders/:id/cancel` | `api/v1/work_orders#cancel` |
| PATCH | `/api/v1/work_orders/:id/complete` | `api/v1/work_orders#complete` |
| PATCH | `/api/v1/work_orders/:id/hold` | `api/v1/work_orders#hold` |
| PATCH | `/api/v1/work_orders/:id/reject` | `api/v1/work_orders#reject` |
| PATCH | `/api/v1/work_orders/:id/start` | `api/v1/work_orders#start` |
| PATCH | `/api/v1/work_orders/:id/transition` | `api/v1/work_orders#transition` |
| PATCH | `/api/v1/work_orders/:id/verify` | `api/v1/work_orders#verify` |
| GET | `/api/v1/work_orders/:work_order_id/attachments` | `api/v1/attachments#index` |
| POST | `/api/v1/work_orders/:work_order_id/attachments` | `api/v1/attachments#create` |
| DELETE | `/api/v1/work_orders/:work_order_id/attachments/:id` | `api/v1/attachments#destroy` |
| GET | `/api/v1/work_orders/:work_order_id/comments` | `api/v1/comments#index` |
| POST | `/api/v1/work_orders/:work_order_id/comments` | `api/v1/comments#create` |
| DELETE | `/api/v1/work_orders/:work_order_id/comments/:id` | `api/v1/comments#destroy` |
| GET | `/api/v1/work_orders/:work_order_id/parts` | `api/v1/work_order_parts#index` |
| POST | `/api/v1/work_orders/:work_order_id/parts` | `api/v1/work_order_parts#create` |
| DELETE | `/api/v1/work_orders/:work_order_id/parts/:id` | `api/v1/work_order_parts#destroy` |
| GET | `/api/v1/work_orders/overdue` | `api/v1/work_orders#overdue` |
| GET | `/api/v1/work_orders/unassigned` | `api/v1/work_orders#unassigned` |

## work-requests

| Method | Path | Handled by |
| --- | --- | --- |
| POST | `/api/v1/work_requests` | `api/v1/work_requests#create` |
| GET | `/api/v1/work_requests/:token` | `api/v1/work_requests#show` |
