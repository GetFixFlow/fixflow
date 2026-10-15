class AddPublicCodeToAssets < ActiveRecord::Migration[8.1]
  # Just enough of Asset to fill the new column, so the migration does not depend on the model.
  class MigrationAsset < ActiveRecord::Base
    self.table_name = "assets"
  end

  def up
    # A random code for the asset's QR label. Unlike the id and the tag it cannot be counted up to,
    # so the public request form cannot be used to list the company's equipment.
    add_column :assets, :public_code, :string
    MigrationAsset.reset_column_information
    MigrationAsset.where(public_code: nil).find_each do |asset|
      asset.update_columns(public_code: SecureRandom.base58(24)) # rubocop:disable Rails/SkipsModelValidations -- a bare migration model
    end
    change_column_null :assets, :public_code, false
    add_index :assets, :public_code, unique: true
  end

  def down
    remove_column :assets, :public_code
  end
end
