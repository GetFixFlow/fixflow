class CreateAssets < ActiveRecord::Migration[8.1]
  def change
    create_table :assets do |t|
      t.string :name, null: false
      t.string :asset_tag
      t.string :serial_number
      t.string :status, null: false, default: "operational"
      t.references :location, null: true, foreign_key: true
      t.references :organization, null: false, foreign_key: true
      t.jsonb :custom_fields, null: false, default: {}

      t.timestamps
    end

    add_index :assets, :asset_tag
    add_index :assets, :serial_number
    add_index :assets, [ :organization_id, :status ]
    add_index :assets, :custom_fields, using: :gin
  end
end
