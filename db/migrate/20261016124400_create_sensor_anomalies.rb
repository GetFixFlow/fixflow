# A sensor reading that is far outside what that sensor usually reads (see Iot::AnomalyDetector). The reading's own numbers
# are kept here, not a link to the reading, so the age limit on sensor readings (Retention) never has to keep one.
class CreateSensorAnomalies < ActiveRecord::Migration[8.1]
  def change
    create_table :sensor_anomalies do |t|
      t.references :organization, null: false, foreign_key: true
      t.references :asset, null: false, foreign_key: true
      t.references :acknowledged_by, foreign_key: { to_table: :users }
      t.string   :metric_name, null: false
      t.string   :unit
      t.decimal  :value, precision: 15, scale: 6, null: false
      t.decimal  :usual_low, precision: 15, scale: 6, null: false
      t.decimal  :usual_high, precision: 15, scale: 6, null: false
      t.decimal  :usual_middle, precision: 15, scale: 6, null: false
      t.decimal  :score, precision: 10, scale: 2, null: false
      t.integer  :baseline_count, null: false
      t.integer  :status, null: false, default: 0
      t.datetime :recorded_at, null: false
      t.datetime :acknowledged_at
      t.text     :notes
      t.timestamps
    end
    add_index :sensor_anomalies, %i[organization_id status created_at], name: "idx_sensor_anomalies_company_status"
    add_index :sensor_anomalies, %i[asset_id metric_name created_at], name: "idx_sensor_anomalies_sensor"
  end
end
