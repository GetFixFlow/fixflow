# Moving a work order on the schedule screen: to someone else, to another day, or both.
#
# Only work that is still ahead can be moved, and work that has been started stays with the person doing it (changing
# hands in the middle of a job is a decision, made from the work order). The new owner is told, as with any assignment.
# A work order moved to a day keeps its time of day; one with no due date gets the end of the working day.
class ScheduleMove
  class Refused < StandardError
    attr_reader :code

    def initialize(message, code)
      super(message)
      @code = code
    end
  end

  MOVABLE = %w[open assigned in_progress on_hold pending_parts].freeze
  WORKERS = %w[admin manager technician].freeze

  # assignee: nothing given (leave as is), a User, or nil for "nobody". due_on: a Date or nil.
  def self.call(work_order, assignee: :keep, due_on: nil)
    new(work_order, assignee, due_on).call
  end

  def initialize(work_order, assignee, due_on)
    @order = work_order
    @assignee = assignee
    @due_on = due_on
  end

  def call
    refuse_if_not_allowed
    WorkOrder.transaction do
      change_due_date if @due_on
      change_assignee if changes_hands?
    end
    @order
  end

  private

  def changes_hands? = @assignee != :keep && @assignee != @order.assignee

  def refuse_if_not_allowed
    refuse("A #{@order.status.tr('_', ' ')} work order can't be moved.", "NOT_MOVABLE") unless MOVABLE.include?(@order.status)
    return unless changes_hands?

    refuse("Work that has started stays with the person doing it.", "STARTED") if @order.in_progress?
    return unless @assignee && WORKERS.exclude?(@assignee.role)

    refuse("#{@assignee.full_name} is not someone who does work orders.", "NOT_A_WORKER")
  end

  def refuse(message, code) = raise(Refused.new(message, code))

  def change_due_date
    @order.update!(due_date: on_day(@due_on)) unless @order.due_date&.in_time_zone&.to_date == @due_on
  end

  def on_day(date)
    time = @order.due_date&.in_time_zone || end_of_working_day
    Time.zone.local(date.year, date.month, date.day, time.hour, time.min)
  end

  def end_of_working_day
    hour, min = @order.organization.settings_with_defaults.dig("work_hours", "end").split(":").map(&:to_i)
    Time.zone.now.change(hour: hour, min: min)
  end

  def change_assignee = @assignee.nil? ? unassign : hand_over

  # Nobody has it now: back to waiting for someone, unless it was held up for another reason.
  def unassign
    @order.assignee = nil
    @order.status = "open" if @order.assigned?
    @order.save!
    @order.log_activity("unassigned")
  end

  def hand_over
    @order.assignee = @assignee
    if @order.open?
      @order.assign!
    else
      @order.save!
      NotifyAssigneeJob.perform_later(@order.id)
      @order.log_activity("reassigned")
    end
  end
end
