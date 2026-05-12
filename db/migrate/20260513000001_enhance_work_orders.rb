class EnhanceWorkOrders < ActiveRecord::Migration[8.1]
  def change
    change_table :work_orders do |t|
      # Numbering + public request token
      t.string  :work_order_number
      t.string  :public_token

      # New statuses (open → assigned → in_progress → on_hold / pending_parts → completed → verified / cancelled)
      t.change_default :status, from: "open", to: "open"   # keep default; string column stays

      # Time tracking
      t.decimal  :estimated_hours, precision: 6, scale: 2
      t.decimal  :actual_hours,    precision: 6, scale: 2
      t.datetime :started_at
      t.datetime :verified_at

      # Cost tracking
      t.decimal :parts_cost, precision: 10, scale: 2, null: false, default: 0
      t.decimal :labor_cost,  precision: 10, scale: 2, null: false, default: 0

      # Rejection / cancellation
      t.text :rejection_reason
      t.text :cancellation_reason

      # Public request fields (for unauthenticated submissions)
      t.string :requester_name
      t.string :requester_email

      # Verification
      t.references :verified_by, null: true, foreign_key: { to_table: :users }
    end

    add_index :work_orders, :work_order_number, unique: true
    add_index :work_orders, :public_token,      unique: true
  end
end
