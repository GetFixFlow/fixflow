# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_09_10_142222) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"

  create_table "active_storage_attachments", force: :cascade do |t|
    t.bigint "blob_id", null: false
    t.datetime "created_at", null: false
    t.string "name", null: false
    t.bigint "record_id", null: false
    t.string "record_type", null: false
    t.index ["blob_id"], name: "index_active_storage_attachments_on_blob_id"
    t.index ["record_type", "record_id", "name", "blob_id"], name: "index_active_storage_attachments_uniqueness", unique: true
  end

  create_table "active_storage_blobs", force: :cascade do |t|
    t.bigint "byte_size", null: false
    t.string "checksum"
    t.string "content_type"
    t.datetime "created_at", null: false
    t.string "filename", null: false
    t.string "key", null: false
    t.text "metadata"
    t.string "service_name", null: false
    t.index ["key"], name: "index_active_storage_blobs_on_key", unique: true
  end

  create_table "active_storage_variant_records", force: :cascade do |t|
    t.bigint "blob_id", null: false
    t.string "variation_digest", null: false
    t.index ["blob_id", "variation_digest"], name: "index_active_storage_variant_records_uniqueness", unique: true
  end

  create_table "activity_logs", force: :cascade do |t|
    t.string "action", null: false
    t.datetime "created_at", null: false
    t.string "ip_address"
    t.jsonb "metadata", default: {}, null: false
    t.bigint "organization_id", null: false
    t.integer "resource_id"
    t.string "resource_name"
    t.string "resource_type"
    t.bigint "user_id"
    t.index ["action"], name: "index_activity_logs_on_action"
    t.index ["organization_id", "created_at"], name: "index_activity_logs_on_organization_id_and_created_at"
    t.index ["organization_id"], name: "index_activity_logs_on_organization_id"
    t.index ["resource_type", "resource_id"], name: "index_activity_logs_on_resource_type_and_resource_id"
    t.index ["user_id"], name: "index_activity_logs_on_user_id"
  end

  create_table "api_keys", force: :cascade do |t|
    t.boolean "active", default: true, null: false
    t.datetime "created_at", null: false
    t.datetime "expires_at"
    t.string "key_digest", null: false
    t.datetime "last_used_at"
    t.string "name", null: false
    t.bigint "organization_id", null: false
    t.string "scopes", default: [], array: true
    t.datetime "updated_at", null: false
    t.index ["organization_id", "active"], name: "index_api_keys_on_organization_id_and_active"
    t.index ["organization_id"], name: "index_api_keys_on_organization_id"
  end

  create_table "assets", force: :cascade do |t|
    t.string "asset_tag"
    t.datetime "created_at", null: false
    t.jsonb "custom_fields", default: {}, null: false
    t.datetime "discarded_at"
    t.bigint "location_id"
    t.string "name", null: false
    t.bigint "organization_id", null: false
    t.string "serial_number"
    t.string "status", default: "operational", null: false
    t.datetime "updated_at", null: false
    t.index ["asset_tag"], name: "index_assets_on_asset_tag"
    t.index ["custom_fields"], name: "index_assets_on_custom_fields", using: :gin
    t.index ["discarded_at"], name: "index_assets_on_discarded_at"
    t.index ["location_id"], name: "index_assets_on_location_id"
    t.index ["organization_id", "status"], name: "index_assets_on_organization_id_and_status"
    t.index ["organization_id"], name: "index_assets_on_organization_id"
    t.index ["serial_number"], name: "index_assets_on_serial_number"
  end

  create_table "attachments", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "description"
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.bigint "work_order_id", null: false
    t.index ["user_id"], name: "index_attachments_on_user_id"
    t.index ["work_order_id"], name: "index_attachments_on_work_order_id"
  end

  create_table "comments", force: :cascade do |t|
    t.text "body", null: false
    t.bigint "commentable_id", null: false
    t.string "commentable_type", null: false
    t.datetime "created_at", null: false
    t.boolean "internal", default: false, null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.index ["commentable_type", "commentable_id"], name: "index_comments_on_commentable"
    t.index ["commentable_type", "commentable_id"], name: "index_comments_on_commentable_type_and_commentable_id"
    t.index ["user_id"], name: "index_comments_on_user_id"
  end

  create_table "iot_alerts", force: :cascade do |t|
    t.datetime "acknowledged_at"
    t.bigint "acknowledged_by_id"
    t.bigint "asset_id", null: false
    t.datetime "created_at", null: false
    t.bigint "iot_rule_id", null: false
    t.string "metric_name", null: false
    t.text "notes"
    t.string "operator", null: false
    t.datetime "resolved_at"
    t.bigint "sensor_reading_id", null: false
    t.integer "status", default: 0, null: false
    t.decimal "threshold", precision: 15, scale: 6, null: false
    t.decimal "triggered_value", precision: 15, scale: 6, null: false
    t.datetime "updated_at", null: false
    t.bigint "work_order_id"
    t.index ["acknowledged_by_id"], name: "index_iot_alerts_on_acknowledged_by_id"
    t.index ["asset_id", "created_at"], name: "index_iot_alerts_on_asset_id_and_created_at"
    t.index ["asset_id", "status"], name: "index_iot_alerts_on_asset_id_and_status"
    t.index ["asset_id"], name: "index_iot_alerts_on_asset_id"
    t.index ["created_at"], name: "index_iot_alerts_on_created_at"
    t.index ["iot_rule_id", "status"], name: "index_iot_alerts_on_iot_rule_id_and_status"
    t.index ["iot_rule_id"], name: "index_iot_alerts_on_iot_rule_id"
    t.index ["sensor_reading_id"], name: "index_iot_alerts_on_sensor_reading_id"
    t.index ["work_order_id"], name: "index_iot_alerts_on_work_order_id"
  end

  create_table "iot_rules", force: :cascade do |t|
    t.bigint "asset_id", null: false
    t.integer "assigned_to_id"
    t.boolean "auto_create_wo", default: true, null: false
    t.datetime "breach_started_at"
    t.integer "cooldown_minutes", default: 60
    t.datetime "created_at", null: false
    t.integer "created_by_id"
    t.text "description"
    t.datetime "last_triggered_at"
    t.datetime "last_wo_created_at"
    t.string "metric_name", null: false
    t.string "name", null: false
    t.integer "operator", default: 0, null: false
    t.bigint "organization_id", null: false
    t.integer "status", default: 0, null: false
    t.integer "sustained_duration_seconds"
    t.decimal "threshold", precision: 15, scale: 6, null: false
    t.decimal "threshold_max", precision: 15, scale: 6
    t.integer "times_acknowledged", default: 0, null: false
    t.integer "trigger_count", default: 0, null: false
    t.string "unit"
    t.datetime "updated_at", null: false
    t.text "wo_description_template"
    t.integer "wo_priority", default: 1, null: false
    t.string "wo_title_template"
    t.index ["asset_id"], name: "index_iot_rules_on_asset_id"
    t.index ["organization_id"], name: "index_iot_rules_on_organization_id"
  end

  create_table "locations", force: :cascade do |t|
    t.string "ancestry"
    t.datetime "created_at", null: false
    t.string "location_type", default: "site", null: false
    t.string "name", null: false
    t.bigint "organization_id", null: false
    t.datetime "updated_at", null: false
    t.index ["ancestry"], name: "index_locations_on_ancestry"
    t.index ["organization_id", "name"], name: "index_locations_on_organization_id_and_name"
    t.index ["organization_id"], name: "index_locations_on_organization_id"
  end

  create_table "organizations", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "name", null: false
    t.jsonb "settings", default: {}, null: false
    t.string "subdomain", null: false
    t.datetime "updated_at", null: false
    t.index ["settings"], name: "index_organizations_on_settings", using: :gin
    t.index ["subdomain"], name: "index_organizations_on_subdomain", unique: true
  end

  create_table "parts", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "location_id"
    t.string "name", null: false
    t.bigint "organization_id", null: false
    t.decimal "quantity_on_hand", precision: 10, scale: 2, default: "0.0", null: false
    t.decimal "reorder_point", precision: 10, scale: 2, default: "0.0", null: false
    t.string "sku"
    t.string "unit", default: "each"
    t.datetime "updated_at", null: false
    t.index ["location_id"], name: "index_parts_on_location_id"
    t.index ["organization_id", "name"], name: "index_parts_on_organization_id_and_name"
    t.index ["organization_id"], name: "index_parts_on_organization_id"
    t.index ["sku"], name: "index_parts_on_sku"
  end

  create_table "pm_executions", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.datetime "generated_at"
    t.text "notes"
    t.bigint "preventive_maintenance_id", null: false
    t.date "scheduled_date", null: false
    t.text "skip_reason"
    t.integer "status", default: 0, null: false
    t.datetime "updated_at", null: false
    t.bigint "work_order_id"
    t.index ["preventive_maintenance_id"], name: "index_pm_executions_on_preventive_maintenance_id"
    t.index ["scheduled_date"], name: "index_pm_executions_on_scheduled_date"
    t.index ["status"], name: "index_pm_executions_on_status"
    t.index ["work_order_id"], name: "index_pm_executions_on_work_order_id"
  end

  create_table "preventive_maintenances", force: :cascade do |t|
    t.bigint "asset_id", null: false
    t.bigint "assigned_to_id"
    t.datetime "created_at", null: false
    t.text "description"
    t.date "end_date"
    t.decimal "estimated_hours", precision: 6, scale: 2
    t.integer "frequency_type", default: 0, null: false
    t.string "frequency_unit", default: "days"
    t.integer "frequency_value", default: 30, null: false
    t.datetime "last_run_at"
    t.string "name", null: false
    t.datetime "next_due_at"
    t.bigint "organization_id", null: false
    t.integer "priority", default: 2, null: false
    t.date "start_date"
    t.integer "status", default: 0, null: false
    t.jsonb "template", default: {}, null: false
    t.integer "times_completed", default: 0, null: false
    t.integer "times_generated", default: 0, null: false
    t.integer "times_skipped", default: 0, null: false
    t.datetime "updated_at", null: false
    t.index ["asset_id"], name: "index_preventive_maintenances_on_asset_id"
    t.index ["assigned_to_id"], name: "index_preventive_maintenances_on_assigned_to_id"
    t.index ["next_due_at"], name: "index_preventive_maintenances_on_next_due_at"
    t.index ["organization_id", "status"], name: "index_preventive_maintenances_on_organization_id_and_status"
    t.index ["organization_id"], name: "index_preventive_maintenances_on_organization_id"
    t.index ["status"], name: "index_preventive_maintenances_on_status"
  end

  create_table "sensor_aggregates", force: :cascade do |t|
    t.bigint "asset_id", null: false
    t.decimal "avg_value", precision: 15, scale: 6
    t.datetime "created_at", null: false
    t.decimal "max_value", precision: 15, scale: 6
    t.string "metric_name", null: false
    t.decimal "min_value", precision: 15, scale: 6
    t.datetime "period_start", null: false
    t.integer "period_type", default: 0, null: false
    t.integer "reading_count", default: 0
    t.datetime "updated_at", null: false
    t.index ["asset_id", "metric_name", "period_start", "period_type"], name: "idx_sensor_aggregates_unique", unique: true
    t.index ["asset_id"], name: "index_sensor_aggregates_on_asset_id"
  end

  create_table "sensor_readings", force: :cascade do |t|
    t.bigint "asset_id", null: false
    t.datetime "created_at", null: false
    t.string "device_id"
    t.string "device_name"
    t.string "metric_name", null: false
    t.bigint "organization_id"
    t.integer "quality", default: 0, null: false
    t.jsonb "raw_payload", default: {}, null: false
    t.datetime "received_at"
    t.datetime "recorded_at", null: false
    t.integer "source", default: 1, null: false
    t.string "unit"
    t.datetime "updated_at", null: false
    t.decimal "value", precision: 15, scale: 6, null: false
    t.index ["asset_id", "metric_name", "recorded_at"], name: "idx_on_asset_id_metric_name_recorded_at_02b856e6bf"
    t.index ["asset_id"], name: "index_sensor_readings_on_asset_id"
    t.index ["organization_id", "recorded_at"], name: "index_sensor_readings_on_organization_id_and_recorded_at"
    t.index ["organization_id"], name: "index_sensor_readings_on_organization_id"
    t.index ["recorded_at"], name: "index_sensor_readings_on_recorded_at"
  end

  create_table "users", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.datetime "current_sign_in_at"
    t.string "current_sign_in_ip"
    t.string "email", default: "", null: false
    t.string "encrypted_password", default: "", null: false
    t.string "first_name"
    t.string "jti", null: false
    t.string "last_name"
    t.datetime "last_sign_in_at"
    t.string "last_sign_in_ip"
    t.bigint "organization_id", null: false
    t.string "phone"
    t.datetime "remember_created_at"
    t.datetime "reset_password_sent_at"
    t.string "reset_password_token"
    t.string "role", default: "technician", null: false
    t.integer "sign_in_count", default: 0, null: false
    t.datetime "updated_at", null: false
    t.index ["email"], name: "index_users_on_email", unique: true
    t.index ["jti"], name: "index_users_on_jti", unique: true
    t.index ["organization_id", "role"], name: "index_users_on_organization_id_and_role"
    t.index ["organization_id"], name: "index_users_on_organization_id"
    t.index ["reset_password_token"], name: "index_users_on_reset_password_token", unique: true
  end

  create_table "versions", force: :cascade do |t|
    t.datetime "created_at"
    t.string "event", null: false
    t.bigint "item_id", null: false
    t.string "item_type", null: false
    t.text "object"
    t.text "object_changes"
    t.string "whodunnit"
    t.index ["item_type", "item_id"], name: "index_versions_on_item_type_and_item_id"
  end

  create_table "work_order_parts", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "part_id", null: false
    t.integer "quantity_used", default: 1, null: false
    t.decimal "unit_cost", precision: 10, scale: 2
    t.datetime "updated_at", null: false
    t.bigint "work_order_id", null: false
    t.index ["part_id"], name: "index_work_order_parts_on_part_id"
    t.index ["work_order_id", "part_id"], name: "index_work_order_parts_on_work_order_id_and_part_id"
    t.index ["work_order_id"], name: "index_work_order_parts_on_work_order_id"
  end

  create_table "work_orders", force: :cascade do |t|
    t.decimal "actual_hours", precision: 6, scale: 2
    t.bigint "asset_id"
    t.bigint "assignee_id"
    t.text "cancellation_reason"
    t.jsonb "checklist", default: [], null: false
    t.datetime "completed_at"
    t.text "completion_notes"
    t.datetime "created_at", null: false
    t.text "description"
    t.datetime "due_date"
    t.decimal "estimated_hours", precision: 6, scale: 2
    t.bigint "iot_alert_id"
    t.bigint "iot_rule_id"
    t.decimal "labor_cost", precision: 10, scale: 2, default: "0.0", null: false
    t.bigint "organization_id", null: false
    t.decimal "parts_cost", precision: 10, scale: 2, default: "0.0", null: false
    t.bigint "preventive_maintenance_id"
    t.string "priority", default: "medium", null: false
    t.string "public_token"
    t.text "rejection_reason"
    t.string "requester_email"
    t.bigint "requester_id"
    t.string "requester_name"
    t.datetime "started_at"
    t.string "status", default: "open", null: false
    t.string "title", null: false
    t.datetime "updated_at", null: false
    t.datetime "verified_at"
    t.bigint "verified_by_id"
    t.string "work_order_number"
    t.index ["asset_id", "created_at"], name: "index_work_orders_on_asset_id_and_created_at"
    t.index ["asset_id"], name: "index_work_orders_on_asset_id"
    t.index ["assignee_id", "status"], name: "index_work_orders_on_assignee_id_and_status"
    t.index ["assignee_id"], name: "index_work_orders_on_assignee_id"
    t.index ["completed_at"], name: "index_work_orders_on_completed_at"
    t.index ["created_at"], name: "index_work_orders_on_created_at"
    t.index ["due_date"], name: "index_work_orders_on_due_date"
    t.index ["iot_alert_id"], name: "index_work_orders_on_iot_alert_id"
    t.index ["iot_rule_id"], name: "index_work_orders_on_iot_rule_id"
    t.index ["organization_id", "due_date"], name: "index_work_orders_on_organization_id_and_due_date"
    t.index ["organization_id", "priority"], name: "index_work_orders_on_organization_id_and_priority"
    t.index ["organization_id", "status"], name: "index_work_orders_on_organization_id_and_status"
    t.index ["organization_id"], name: "index_work_orders_on_organization_id"
    t.index ["preventive_maintenance_id"], name: "index_work_orders_on_preventive_maintenance_id"
    t.index ["public_token"], name: "index_work_orders_on_public_token", unique: true
    t.index ["requester_id"], name: "index_work_orders_on_requester_id"
    t.index ["verified_by_id"], name: "index_work_orders_on_verified_by_id"
    t.index ["work_order_number"], name: "index_work_orders_on_work_order_number", unique: true
  end

  add_foreign_key "active_storage_attachments", "active_storage_blobs", column: "blob_id"
  add_foreign_key "active_storage_variant_records", "active_storage_blobs", column: "blob_id"
  add_foreign_key "activity_logs", "organizations"
  add_foreign_key "activity_logs", "users"
  add_foreign_key "api_keys", "organizations"
  add_foreign_key "assets", "locations"
  add_foreign_key "assets", "organizations"
  add_foreign_key "attachments", "users"
  add_foreign_key "attachments", "work_orders"
  add_foreign_key "comments", "users"
  add_foreign_key "iot_alerts", "assets"
  add_foreign_key "iot_alerts", "iot_rules"
  add_foreign_key "iot_alerts", "sensor_readings"
  add_foreign_key "iot_alerts", "users", column: "acknowledged_by_id"
  add_foreign_key "iot_alerts", "work_orders"
  add_foreign_key "iot_rules", "assets"
  add_foreign_key "iot_rules", "organizations"
  add_foreign_key "iot_rules", "users", column: "assigned_to_id"
  add_foreign_key "iot_rules", "users", column: "created_by_id"
  add_foreign_key "locations", "organizations"
  add_foreign_key "parts", "locations"
  add_foreign_key "parts", "organizations"
  add_foreign_key "pm_executions", "preventive_maintenances"
  add_foreign_key "pm_executions", "work_orders"
  add_foreign_key "preventive_maintenances", "assets"
  add_foreign_key "preventive_maintenances", "organizations"
  add_foreign_key "preventive_maintenances", "users", column: "assigned_to_id"
  add_foreign_key "sensor_aggregates", "assets"
  add_foreign_key "sensor_readings", "assets"
  add_foreign_key "sensor_readings", "organizations"
  add_foreign_key "users", "organizations"
  add_foreign_key "work_order_parts", "parts"
  add_foreign_key "work_order_parts", "work_orders"
  add_foreign_key "work_orders", "assets"
  add_foreign_key "work_orders", "iot_alerts"
  add_foreign_key "work_orders", "iot_rules"
  add_foreign_key "work_orders", "organizations"
  add_foreign_key "work_orders", "preventive_maintenances"
  add_foreign_key "work_orders", "users", column: "assignee_id"
  add_foreign_key "work_orders", "users", column: "requester_id"
  add_foreign_key "work_orders", "users", column: "verified_by_id"
end
