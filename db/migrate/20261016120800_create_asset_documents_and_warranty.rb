# Manuals, photos and certificates kept with an asset, and the date its warranty ends. A manager is warned 30 days
# before that date, once for each date: warranty_alerted_on is the end date they were last warned about.
class CreateAssetDocumentsAndWarranty < ActiveRecord::Migration[8.1]
  def change
    add_column :assets, :warranty_expires_on, :date
    add_column :assets, :warranty_alerted_on, :date
    add_index  :assets, %i[organization_id warranty_expires_on], where: "warranty_expires_on IS NOT NULL",
                                                                 name: "index_assets_on_organization_and_warranty"

    create_table :asset_documents do |t|
      t.references :asset, null: false, foreign_key: true
      t.references :user, null: false, foreign_key: true
      t.string :description

      t.timestamps
    end
  end
end
