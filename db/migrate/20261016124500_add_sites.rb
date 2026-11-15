# Several sites in one install. A site is a top-level location of type "site" (the place tree that was already there), so what is
# new is who works at which site (site_memberships) and what a site's calendar is (locations.settings, used only on a site).
class AddSites < ActiveRecord::Migration[8.1]
  def change
    create_table :site_memberships do |t|
      t.references :user, null: false, foreign_key: true
      t.references :site, null: false, foreign_key: { to_table: :locations }
      t.timestamps
    end
    add_index :site_memberships, %i[user_id site_id], unique: true

    add_column :locations, :settings, :jsonb, default: {}, null: false
  end
end
