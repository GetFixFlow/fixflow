class AddClientIdToComments < ActiveRecord::Migration[8.1]
  def change
    # Lets a phone that lost signal post the same comment again without it appearing twice.
    add_column :comments, :client_id, :string
    add_index :comments, %i[commentable_type commentable_id client_id], unique: true,
              where: "client_id IS NOT NULL", name: "index_comments_on_commentable_and_client_id"
  end
end
