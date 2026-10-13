# Until now nothing marked a PM execution completed when its work order was finished, so
# every execution is still "generated" and times_completed is 0. Catch the history up.
class BackfillCompletedPmExecutions < ActiveRecord::Migration[8.1]
  def up
    execute <<~SQL.squish
      UPDATE pm_executions
         SET status = 3
        FROM work_orders
       WHERE pm_executions.work_order_id = work_orders.id
         AND work_orders.status IN ('completed', 'verified')
         AND pm_executions.status = 1
    SQL
    execute <<~SQL.squish
      UPDATE preventive_maintenances
         SET times_completed = (SELECT COUNT(*) FROM pm_executions
                                 WHERE pm_executions.preventive_maintenance_id = preventive_maintenances.id
                                   AND pm_executions.status = 3)
    SQL
  end

  def down
    # The earlier values were wrong, so there is nothing worth restoring.
  end
end
