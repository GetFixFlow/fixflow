class CreateParts < ActiveRecord::Migration[8.1]
  def change
    create_table :parts do |t|
      t.string :name, null: false
      t.string :sku
      t.decimal :quantity_on_hand, null: false, default: 0, precision: 10, scale: 2
      t.decimal :reorder_point, null: false, default: 0, precision: 10, scale: 2
      t.string :unit, default: "each"
      t.references :location, null: true, foreign_key: true
      t.references :organization, null: false, foreign_key: true

      t.timestamps
    end

    add_index :parts, :sku
    add_index :parts, [ :organization_id, :name ]
  end
end
