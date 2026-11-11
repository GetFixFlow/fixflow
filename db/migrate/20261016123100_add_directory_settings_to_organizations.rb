# How the company signs in through its directory: the OpenID Connect and LDAP settings and the group to role mapping
# (the secrets in it are encrypted).
class AddDirectorySettingsToOrganizations < ActiveRecord::Migration[8.1]
  def change
    add_column :organizations, :directory_settings, :jsonb, default: {}, null: false
  end
end
