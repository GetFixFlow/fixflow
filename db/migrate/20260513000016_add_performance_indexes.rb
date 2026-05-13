class AddPerformanceIndexes < ActiveRecord::Migration[8.1]
  def change
    # Work Orders — compound indexes for reporting queries
    # [organization_id, status] and [organization_id, priority] and completed_at
    # already exist from 20260503000005; add missing ones:
    add_index :work_orders, %i[assignee_id status],   if_not_exists: true
    add_index :work_orders, %i[asset_id created_at],  if_not_exists: true
    add_index :work_orders, :created_at,              if_not_exists: true
    add_index :work_orders, %i[organization_id due_date], if_not_exists: true

    # Preventive Maintenances
    add_index :preventive_maintenances, :next_due_at, if_not_exists: true

    # IoT Alerts — time-range reporting
    add_index :iot_alerts, %i[asset_id created_at], if_not_exists: true

    # Sensor Readings — already indexed in Session 6, but belt-and-suspenders
    add_index :sensor_readings, %i[asset_id metric_name recorded_at], if_not_exists: true
    add_index :sensor_readings, :recorded_at, if_not_exists: true
  end
end
