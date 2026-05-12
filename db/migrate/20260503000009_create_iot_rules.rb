class CreateIotRules < ActiveRecord::Migration[8.1]
  def change
    create_table :iot_rules do |t|
      t.references :asset, null: false, foreign_key: true
      t.references :organization, null: false, foreign_key: true
      t.string :name, null: false
      t.string :metric_name, null: false
      t.string :operator, null: false
      t.decimal :threshold, null: false, precision: 15, scale: 6
      t.string :priority, null: false, default: "high"
      t.boolean :auto_create_wo, null: false, default: true
      t.boolean :active, null: false, default: true
      t.integer :duration_seconds
      t.string :work_order_title_template
      t.integer :cooldown_minutes, default: 60

      t.timestamps
    end

    add_index :iot_rules, [ :asset_id, :active ]
    add_index :iot_rules, [ :organization_id, :active ]
  end
end
