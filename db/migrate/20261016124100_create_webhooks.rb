# Outbound webhooks: the addresses the company's other systems listen on, and a record of every message sent to them.
class CreateWebhooks < ActiveRecord::Migration[8.1]
  def change
    create_table :webhooks do |t|
      t.references :organization, null: false, foreign_key: true
      t.references :created_by, foreign_key: { to_table: :users, on_delete: :nullify }
      t.string :name, null: false
      t.string :url, null: false
      t.text :secret_ciphertext
      t.string :events, array: true, default: [], null: false
      t.boolean :active, default: true, null: false
      t.integer :consecutive_failures, default: 0, null: false
      t.datetime :disabled_at
      t.string :disabled_reason
      t.datetime :last_delivery_at
      t.timestamps
    end

    create_table :webhook_deliveries do |t|
      t.references :webhook, null: false, foreign_key: true
      t.references :organization, null: false, foreign_key: true
      t.string :event_id, null: false
      t.string :event, null: false
      t.jsonb :payload, default: {}, null: false
      t.string :status, default: "pending", null: false
      t.integer :attempts, default: 0, null: false
      t.integer :response_code
      t.string :response_excerpt
      t.string :error
      t.datetime :next_attempt_at
      t.datetime :delivered_at
      t.timestamps
    end
    add_index :webhook_deliveries, %i[webhook_id created_at]
    add_index :webhook_deliveries, :event_id
  end
end
