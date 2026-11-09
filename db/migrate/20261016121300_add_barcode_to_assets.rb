# The number on a sticker that is already on a machine (a maker's barcode, the company's own tag), so that scanning it
# finds the asset. Free text, at most one live asset per company for each.
class AddBarcodeToAssets < ActiveRecord::Migration[8.1]
  def change
    add_column :assets, :barcode, :string
    add_index :assets, "organization_id, lower(barcode)", unique: true, where: "barcode IS NOT NULL AND discarded_at IS NULL",
                                                          name: "index_assets_on_org_and_lower_barcode"
  end
end
