class AddIotColumnsToWorkOrders < ActiveRecord::Migration[8.1]
  def change
    add_reference :work_orders, :iot_rule,  foreign_key: true
    add_reference :work_orders, :iot_alert, foreign_key: true
  end
end
