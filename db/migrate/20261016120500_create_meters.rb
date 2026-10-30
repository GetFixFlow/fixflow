# Meters (running hours, kilometres, cycles) on an asset, their history, and the link from a preventive maintenance
# schedule to the meter whose reading makes it due.
class CreateMeters < ActiveRecord::Migration[8.1]
  def change
    create_table :meters do |t|
      t.references :organization, null: false, foreign_key: true
      t.references :asset, null: false, foreign_key: true
      t.string   :name, null: false
      t.string   :unit, null: false
      t.decimal  :reading, precision: 14, scale: 2, null: false, default: 0
      t.datetime :last_reading_at
      # The sensor metric ("running_hours") whose value becomes this meter's reading; empty when it is read by hand.
      t.string   :sensor_metric
      t.timestamps
    end
    add_index :meters, %i[asset_id name], unique: true
    add_index :meters, %i[asset_id sensor_metric], unique: true, where: "sensor_metric IS NOT NULL",
              name: "index_meters_on_asset_id_and_sensor_metric"

    create_table :meter_readings do |t|
      t.references :meter, null: false, foreign_key: true
      t.references :recorded_by, foreign_key: { to_table: :users }
      t.decimal  :value, precision: 14, scale: 2, null: false
      t.datetime :recorded_at, null: false
      t.integer  :source, null: false, default: 0
      # The meter was replaced or reset, so a lower value is right.
      t.boolean  :reset, null: false, default: false
      t.text     :note
      t.timestamps
    end
    add_index :meter_readings, %i[meter_id recorded_at]

    add_reference :preventive_maintenances, :meter, foreign_key: true
    add_column :preventive_maintenances, :next_due_reading, :decimal, precision: 14, scale: 2
  end
end
