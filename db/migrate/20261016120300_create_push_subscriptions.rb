class CreatePushSubscriptions < ActiveRecord::Migration[8.1]
  def change
    # One row for each browser or phone that asked to be pushed to (Web Push): the address of the browser vendor's push
    # service for it, and the two keys that make a message readable only by that browser.
    create_table :push_subscriptions do |t|
      t.references :user, null: false, foreign_key: true
      t.text :endpoint, null: false
      t.string :p256dh, null: false
      t.string :auth, null: false
      t.string :user_agent
      t.datetime :last_sent_at
      t.integer :failures, null: false, default: 0 # in a row; the push service refusing too often removes the row
      t.timestamps
    end
    add_index :push_subscriptions, :endpoint, unique: true
  end
end
