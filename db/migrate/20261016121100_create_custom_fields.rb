# Fields that an administrator adds to work orders and parts ("Cost centre", "Hazard class"): the definitions, and a
# place on each record for what was filled in. Assets keep their own free-form pairs.
class CreateCustomFields < ActiveRecord::Migration[8.1]
  def change
    create_table :custom_fields do |t|
      t.references :organization, null: false, foreign_key: true
      # work_order or part
      t.string  :entity, null: false
      # The name inside each record's custom_values; made from the label once, never changed after.
      t.string  :key, null: false
      t.string  :label, null: false
      # text, number, date, select (one of the options) or checkbox
      t.string  :kind, null: false
      t.jsonb   :options, null: false, default: []
      t.boolean :required, null: false, default: false
      # Whether the lists show it as a column.
      t.boolean :in_list, null: false, default: false
      # A field that is turned off is hidden everywhere, and what was filled in stays.
      t.boolean :active, null: false, default: true
      t.integer :position, null: false, default: 0
      t.timestamps
    end
    add_index :custom_fields, %i[organization_id entity key], unique: true

    add_column :work_orders, :custom_values, :jsonb, null: false, default: {}
    add_column :parts, :custom_values, :jsonb, null: false, default: {}
  end
end
