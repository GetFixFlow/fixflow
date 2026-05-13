class AddPmIdToWorkOrders < ActiveRecord::Migration[8.1]
  def change
    add_column :work_orders, :preventive_maintenance_id, :bigint
    add_index  :work_orders, :preventive_maintenance_id
    add_foreign_key :work_orders, :preventive_maintenances
  end
end
