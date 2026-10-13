# The numbers behind the preventive maintenance dashboard.
#
# Compliance is: of the PM executions that have come due in the period, how many were
# completed. Skipped executions and ones past their date and still not done count
# against it; executions not yet due are left out. With nothing due the answer is nil
# (no data), not 0 or 100.
class PmDashboardService
  TREND_MONTHS = 6

  def initialize(organization, days: 90, today: Date.current)
    @organization = organization
    @days         = days
    @today        = today
  end

  def call
    {
      period_days:          @days,
      overall_compliance:   compliance(tally(period)),
      compliance_change:    compliance_change,
      due_this_week:        upcoming.count,
      overdue_count:        active.overdue.count,
      completed_this_month: month_executions.status_completed.count,
      scheduled_this_month: month_executions.count,
      avg_completion_hours: average_hours(:actual_hours),
      avg_estimated_hours:  average_hours(:estimated_hours),
      monthly_trend:        monthly_trend,
      by_location:          by_location,
      overdue_pms:          PreventiveMaintenanceBlueprint.render_as_hash(active.overdue.includes(:asset).order(:next_due_at)),
      upcoming_week:        upcoming_week,
      recent_activity:      recent_activity
    }
  end

  private

  def executions
    PmExecution.joins(:preventive_maintenance)
               .where(preventive_maintenances: { organization_id: @organization.id })
  end

  def active
    @organization.preventive_maintenances.status_active
  end

  # Due from now through the next 7 days. Schedules already overdue have their own list.
  def upcoming
    active.where(next_due_at: Time.current..7.days.from_now)
  end

  # Executions that have come due (today included) between two dates.
  def due_between(from, to)
    executions.where(scheduled_date: from..[to, @today].min)
  end

  def period
    due_between(@today - @days + 1, @today)
  end

  def previous_period
    due_between(@today - (2 * @days) + 1, @today - @days)
  end

  def month_executions
    executions.where(scheduled_date: @today.all_month)
  end

  def tally(scope)
    completed = scope.status_completed.count
    skipped   = scope.status_skipped.count
    missed    = scope.where(status: %i[pending generated]).where(scheduled_date: ...@today).count
    { completed: completed, skipped: skipped, missed: missed }
  end

  def compliance(counts)
    due = counts.values.sum
    return nil if due.zero?

    (counts[:completed].to_f / due * 100).round(1)
  end

  def compliance_change
    now = compliance(tally(period))
    before = compliance(tally(previous_period))
    return nil if now.nil? || before.nil?

    (now - before).round(1)
  end

  def completed_work_orders
    WorkOrder.unscoped.where(id: period.status_completed.select(:work_order_id))
  end

  def average_hours(column)
    average = completed_work_orders.where.not(column => nil).average(column)
    average&.to_f&.round(1)
  end

  def monthly_trend
    (0...TREND_MONTHS).map { |ago| @today.beginning_of_month << (TREND_MONTHS - 1 - ago) }.map do |first|
      counts = tally(due_between(first, first.end_of_month))
      { month: first.strftime("%Y-%m"), completed: counts[:completed],
        missed: counts[:skipped] + counts[:missed], compliance: compliance(counts) }
    end
  end

  def by_location
    period.includes(preventive_maintenance: { asset: :location })
          .group_by { |execution| execution.preventive_maintenance.asset&.location&.name || "No location" }
          .map { |name, rows| location_row(name, rows) }
          .sort_by { |row| row[:compliance] }
  end

  def location_row(name, rows)
    counts = { completed: rows.count(&:status_completed?), skipped: rows.count(&:status_skipped?),
               missed: rows.count { |row| row.status_pending? || row.status_generated? } }
    { location_name: name, compliance: compliance(counts), count: rows.size }
  end

  def upcoming_week
    upcoming.includes(:asset).order(:next_due_at).map do |pm|
      { pm: PreventiveMaintenanceBlueprint.render_as_hash(pm), due_date: pm.next_due_at }
    end
  end

  def recent_activity
    executions.includes(:work_order, :preventive_maintenance)
              .where(scheduled_date: ..@today)
              .order(scheduled_date: :desc, id: :desc).limit(10)
              .map { |execution| activity(execution) }
  end

  def activity(execution)
    {
      type:        activity_type(execution),
      pm_name:     execution.preventive_maintenance.name,
      wo_number:   execution.work_order&.work_order_number,
      occurred_at: occurred_at(execution)
    }
  end

  def activity_type(execution)
    return "completed" if execution.status_completed?
    return "skipped"   if execution.status_skipped?
    return "missed"    if execution.scheduled_date < @today

    "generated"
  end

  def occurred_at(execution)
    case activity_type(execution)
    when "completed" then execution.work_order&.completed_at || execution.updated_at
    when "skipped"   then execution.updated_at
    when "missed"    then execution.scheduled_date
    else execution.generated_at || execution.scheduled_date
    end
  end
end
