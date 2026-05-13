class CreateApiKeys < ActiveRecord::Migration[8.1]
  def change
    create_table :api_keys do |t|
      t.references :organization, null: false, foreign_key: true
      t.string  :name,        null: false
      t.string  :key_digest,  null: false
      t.datetime :last_used_at
      t.datetime :expires_at
      t.boolean  :active,     null: false, default: true
      t.string   :scopes,     array: true, default: []

      t.timestamps
    end

    add_index :api_keys, %i[organization_id active]
  end
end
