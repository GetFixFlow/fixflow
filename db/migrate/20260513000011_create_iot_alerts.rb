class CreateIotAlerts < ActiveRecord::Migration[8.1]
  def change
    create_table :iot_alerts do |t|
      t.references :iot_rule,       null: false, foreign_key: true
      t.references :asset,          null: false, foreign_key: true
      t.references :sensor_reading, null: false, foreign_key: true
      t.string     :metric_name,    null: false
      t.decimal    :triggered_value, null: false, precision: 15, scale: 6
      t.decimal    :threshold,       null: false, precision: 15, scale: 6
      t.string     :operator,        null: false
      t.references :work_order,      foreign_key: true
      t.integer    :status,          null: false, default: 0  # open
      t.references :acknowledged_by, foreign_key: { to_table: :users }
      t.datetime   :acknowledged_at
      t.datetime   :resolved_at
      t.text       :notes

      t.timestamps
    end

    add_index :iot_alerts, %i[iot_rule_id status]
    add_index :iot_alerts, %i[asset_id status]
    add_index :iot_alerts, :created_at
  end
end
