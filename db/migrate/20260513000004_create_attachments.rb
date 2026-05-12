class CreateAttachments < ActiveRecord::Migration[8.1]
  def change
    create_table :attachments do |t|
      t.references :work_order, null: false, foreign_key: true
      t.references :user,       null: false, foreign_key: true
      t.string :description

      t.timestamps
    end
  end
end
