class AddClientIdToAttachments < ActiveRecord::Migration[8.1]
  def change
    # Lets a phone that lost signal send the same photo again without it appearing twice.
    add_column :attachments, :client_id, :string
    add_index :attachments, %i[work_order_id client_id], unique: true,
              where: "client_id IS NOT NULL", name: "index_attachments_on_work_order_and_client_id"
  end
end
