class AddUnitCostToPartsAndBackfillPartsCost < ActiveRecord::Migration[8.1]
  def up
    add_column :parts, :unit_cost, :decimal, precision: 10, scale: 2

    # work_orders.parts_cost was never filled in, so cost reports show no parts cost.
    execute <<~SQL.squish
      UPDATE work_orders
         SET parts_cost = COALESCE((SELECT SUM(quantity_used * COALESCE(unit_cost, 0))
                                      FROM work_order_parts
                                     WHERE work_order_parts.work_order_id = work_orders.id), 0)
    SQL
  end

  def down
    remove_column :parts, :unit_cost
  end
end
