class CreateLocations < ActiveRecord::Migration[8.1]
  def change
    create_table :locations do |t|
      t.string :name, null: false
      t.string :location_type, null: false, default: "site"
      t.references :parent, null: true, foreign_key: { to_table: :locations }
      t.references :organization, null: false, foreign_key: true

      t.timestamps
    end

    add_index :locations, [ :organization_id, :name ]
  end
end
