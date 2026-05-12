class CreateWorkOrderParts < ActiveRecord::Migration[8.1]
  def change
    create_table :work_order_parts do |t|
      t.references :work_order, null: false, foreign_key: true
      t.references :part,       null: false, foreign_key: true
      t.integer :quantity_used, null: false, default: 1
      t.decimal :unit_cost,     precision: 10, scale: 2

      t.timestamps
    end

    add_index :work_order_parts, [ :work_order_id, :part_id ]
  end
end
