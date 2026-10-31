# Purchase requests and orders for parts: someone asks for stock, a manager approves, it is ordered from a vendor and
# received, and receiving adds to the stock on hand.
class CreatePurchaseOrders < ActiveRecord::Migration[8.1]
  def change
    create_table :purchase_orders do |t|
      t.references :organization, null: false, foreign_key: true
      t.string  :number, null: false
      t.string  :status, null: false, default: "requested"
      t.references :vendor, foreign_key: true
      t.references :requested_by, foreign_key: { to_table: :users }
      t.references :decided_by, foreign_key: { to_table: :users }
      t.text    :reason
      t.text    :rejection_reason
      t.text    :notes
      # The supplier's own order or quote number.
      t.string  :supplier_reference
      t.date    :expected_on
      t.datetime :decided_at
      t.datetime :ordered_at
      t.datetime :received_at
      t.timestamps
    end
    add_index :purchase_orders, %i[organization_id number], unique: true
    add_index :purchase_orders, %i[organization_id status]

    create_table :purchase_order_lines do |t|
      t.references :purchase_order, null: false, foreign_key: true
      t.references :part, null: false, foreign_key: true
      t.decimal :quantity, precision: 10, scale: 2, null: false
      t.decimal :unit_cost, precision: 10, scale: 2
      t.decimal :quantity_received, precision: 10, scale: 2, null: false, default: "0.0"
      t.timestamps
    end
  end
end
