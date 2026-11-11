# Who signs in through the company directory (OpenID Connect or LDAP) rather than with a FixFlow password: which
# directory, and the person's stable id there (so a changed email or name still finds the same person).
class AddDirectoryToUsers < ActiveRecord::Migration[8.1]
  def change
    add_column :users, :identity_provider, :string
    add_column :users, :external_id, :string
    add_column :users, :directory_synced_at, :datetime
    add_index :users, %i[identity_provider external_id], unique: true, where: "external_id IS NOT NULL",
              name: "index_users_on_identity"
  end
end
