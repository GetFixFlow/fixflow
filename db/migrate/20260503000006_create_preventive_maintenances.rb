class CreatePreventiveMaintenances < ActiveRecord::Migration[8.1]
  def change
    create_table :preventive_maintenances do |t|
      t.string :name, null: false
      t.references :asset, null: false, foreign_key: true
      t.references :organization, null: false, foreign_key: true
      t.string :frequency_type, null: false, default: "calendar"
      t.integer :frequency_value, null: false, default: 30
      t.string :frequency_unit, default: "days"
      t.datetime :last_run_at
      t.datetime :next_due_at
      t.boolean :active, null: false, default: true
      t.jsonb :template, null: false, default: {}

      t.timestamps
    end

    add_index :preventive_maintenances, :next_due_at
    add_index :preventive_maintenances, [ :organization_id, :active ]
  end
end
