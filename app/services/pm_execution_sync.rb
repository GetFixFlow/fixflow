# Keeps a PM execution in step with the work order it generated. Without this an
# execution stays "generated" forever, so no PM is ever counted as completed and every
# compliance figure reads zero.
class PmExecutionSync
  class << self
    # The work order was completed: the maintenance was done.
    def completed(work_order)
      execution = execution_for(work_order) or return
      return if execution.status_completed?

      execution.transaction do
        adjust(execution, :times_skipped, -1) if execution.status_skipped?
        execution.update!(status: :completed)
        adjust(execution, :times_completed, +1)
      end
    end

    # A manager sent the work order back to the technician.
    def reopened(work_order)
      execution = execution_for(work_order) or return
      return unless execution.status_completed?

      execution.transaction do
        execution.update!(status: :generated)
        adjust(execution, :times_completed, -1)
      end
    end

    # The work order was cancelled, so the scheduled maintenance did not happen.
    def cancelled(work_order)
      execution = execution_for(work_order) or return
      return if execution.status_skipped?

      execution.transaction do
        adjust(execution, :times_completed, -1) if execution.status_completed?
        execution.update!(status: :skipped, skip_reason: "Work order cancelled")
        adjust(execution, :times_skipped, +1)
      end
    end

    private

    def execution_for(work_order)
      return unless work_order.preventive_maintenance_id

      PmExecution.find_by(work_order_id: work_order.id)
    end

    # Under a row lock, so two completions at once cannot lose a count.
    def adjust(execution, column, delta)
      schedule = execution.preventive_maintenance
      schedule.with_lock { schedule.update!(column => [schedule[column] + delta, 0].max) }
    end
  end
end
