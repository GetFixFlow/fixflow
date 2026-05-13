class CreateActivityLogs < ActiveRecord::Migration[8.1]
  def change
    create_table :activity_logs do |t|
      t.references :organization, null: false, foreign_key: true
      t.references :user,         foreign_key: true           # nullable for system events
      t.string     :action,       null: false
      t.string     :resource_type
      t.integer    :resource_id
      t.string     :resource_name
      t.jsonb      :metadata,     null: false, default: {}
      t.string     :ip_address

      t.datetime :created_at, null: false
    end

    add_index :activity_logs, %i[organization_id created_at]
    add_index :activity_logs, %i[resource_type resource_id]
    add_index :activity_logs, :action
  end
end
