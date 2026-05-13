class CreateSensorAggregates < ActiveRecord::Migration[8.1]
  def change
    create_table :sensor_aggregates do |t|
      t.references :asset,       null: false, foreign_key: true
      t.string     :metric_name, null: false
      t.datetime   :period_start, null: false
      t.integer    :period_type,  null: false, default: 0  # hourly
      t.decimal    :min_value,    precision: 15, scale: 6
      t.decimal    :max_value,    precision: 15, scale: 6
      t.decimal    :avg_value,    precision: 15, scale: 6
      t.integer    :reading_count, default: 0

      t.timestamps
    end

    add_index :sensor_aggregates,
      %i[asset_id metric_name period_start period_type],
      unique: true,
      name: "idx_sensor_aggregates_unique"
  end
end
