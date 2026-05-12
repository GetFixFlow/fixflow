class AddAncestryToLocations < ActiveRecord::Migration[8.1]
  def up
    remove_foreign_key :locations, :locations, column: :parent_id
    remove_column :locations, :parent_id
    add_column :locations, :ancestry, :string
    add_index :locations, :ancestry
  end

  def down
    remove_index :locations, :ancestry
    remove_column :locations, :ancestry
    add_reference :locations, :parent, null: true, foreign_key: { to_table: :locations }
  end
end
