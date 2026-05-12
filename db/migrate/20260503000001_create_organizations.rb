class CreateOrganizations < ActiveRecord::Migration[8.1]
  def change
    create_table :organizations do |t|
      t.string :name, null: false
      t.string :subdomain, null: false
      t.jsonb :settings, null: false, default: {}

      t.timestamps
    end

    add_index :organizations, :subdomain, unique: true
    add_index :organizations, :settings, using: :gin
  end
end
