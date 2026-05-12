class CreateSensorReadings < ActiveRecord::Migration[8.1]
  def change
    create_table :sensor_readings do |t|
      t.references :asset, null: false, foreign_key: true
      t.string :metric_name, null: false
      t.decimal :value, null: false, precision: 15, scale: 6
      t.string :unit
      t.datetime :recorded_at, null: false
      t.jsonb :metadata, null: false, default: {}

      t.timestamps
    end

    add_index :sensor_readings, [ :asset_id, :metric_name, :recorded_at ]
    add_index :sensor_readings, :recorded_at
  end
end
