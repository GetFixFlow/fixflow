class AddDeactivatedAtToUsers < ActiveRecord::Migration[8.1]
  def change
    add_column :users, :deactivated_at, :datetime
    add_index :users, %i[organization_id deactivated_at]
  end
end
