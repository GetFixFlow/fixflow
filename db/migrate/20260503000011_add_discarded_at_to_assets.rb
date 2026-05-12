class AddDiscardedAtToAssets < ActiveRecord::Migration[8.1]
  def change
    add_column :assets, :discarded_at, :datetime
    add_index :assets, :discarded_at
  end
end
