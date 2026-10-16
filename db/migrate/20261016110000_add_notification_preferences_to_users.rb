class AddNotificationPreferencesToUsers < ActiveRecord::Migration[8.1]
  def change
    # Which emails a person wants (see EmailPreferences). Empty means everything, as before.
    add_column :users, :notification_preferences, :jsonb, null: false, default: {}
  end
end
