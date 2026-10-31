# A manager's approval of a work order that costs more than the company's approval limit: who, when, and the cost they
# approved (so that a cost that grows past it needs approving again), and when approval was first asked for.
class AddApprovalToWorkOrders < ActiveRecord::Migration[8.1]
  def change
    change_table :work_orders, bulk: true do |t|
      t.references :approved_by, foreign_key: { to_table: :users }
      t.datetime :approved_at
      t.decimal :approved_cost, precision: 12, scale: 2
      t.datetime :approval_requested_at
    end
  end
end
