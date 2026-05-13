class EnhanceSensorReadings < ActiveRecord::Migration[8.1]
  def change
    add_reference :sensor_readings, :organization, foreign_key: true

    rename_column :sensor_readings, :metadata, :raw_payload

    add_column :sensor_readings, :source,      :integer, null: false, default: 1  # rest_api
    add_column :sensor_readings, :device_id,   :string
    add_column :sensor_readings, :device_name, :string
    add_column :sensor_readings, :quality,     :integer, null: false, default: 0  # good
    add_column :sensor_readings, :received_at, :datetime

    add_index :sensor_readings, %i[organization_id recorded_at]
  end
end
