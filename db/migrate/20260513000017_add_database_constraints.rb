class AddDatabaseConstraints < ActiveRecord::Migration[8.1]
  def change
    # ── Work orders ───────────────────────────────────────────────────────
    add_foreign_key :work_orders, :assets,        on_delete: :nullify,  if_not_exists: true
    add_foreign_key :work_orders, :users,   column: :assignee_id, on_delete: :nullify, if_not_exists: true
    add_foreign_key :work_orders, :organizations,                        if_not_exists: true

    # ── Assets ────────────────────────────────────────────────────────────
    add_foreign_key :assets, :organizations,                             if_not_exists: true
    add_foreign_key :assets, :locations,    on_delete: :nullify,         if_not_exists: true

    # ── Sensor readings ────────────────────────────────────────────────────
    add_foreign_key :sensor_readings, :assets, on_delete: :cascade,      if_not_exists: true

    # ── IoT ───────────────────────────────────────────────────────────────
    add_foreign_key :iot_alerts, :iot_rules,                             if_not_exists: true
    add_foreign_key :iot_alerts, :assets,                                if_not_exists: true

    # ── PM ────────────────────────────────────────────────────────────────
    add_foreign_key :pm_executions, :preventive_maintenances,            if_not_exists: true

    # ── Activity logs ─────────────────────────────────────────────────────
    add_foreign_key :activity_logs, :organizations,                      if_not_exists: true

    # ── Sensor readings NOT NULL value (idempotent-safe check) ────────────
    # Skipped as CHECK constraints vary by PG version; model validates presence
  end
end
