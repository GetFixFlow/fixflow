class AddEmailSettingsToOrganizations < ActiveRecord::Migration[8.1]
  def change
    # The mail server an administrator saved in the app (the password is stored encrypted).
    add_column :organizations, :email_settings, :jsonb, null: false, default: {}
  end
end
