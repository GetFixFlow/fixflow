class CreateWorkOrders < ActiveRecord::Migration[8.1]
  def change
    create_table :work_orders do |t|
      t.string :title, null: false
      t.text :description
      t.string :priority, null: false, default: "medium"
      t.string :status, null: false, default: "open"
      t.references :asset, null: true, foreign_key: true
      t.references :assignee, null: true, foreign_key: { to_table: :users }
      t.references :requester, null: true, foreign_key: { to_table: :users }
      t.references :organization, null: false, foreign_key: true
      t.datetime :due_date
      t.datetime :completed_at
      t.jsonb :checklist, null: false, default: []
      t.text :completion_notes

      t.timestamps
    end

    add_index :work_orders, [ :organization_id, :status ]
    add_index :work_orders, [ :organization_id, :priority ]
    add_index :work_orders, :due_date
    add_index :work_orders, :completed_at
  end
end
