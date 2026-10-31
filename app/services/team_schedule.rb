# Who has how much work on which day: the open work orders of a period, laid out by assignee and day against what a
# day's work can hold (the company's work hours, work days and holidays). Behind the schedule screen.
#
# A work order sits on the day it is due. One with no estimate counts as DEFAULT_HOURS, as an empty cell is not the same
# as an hour, and the answer says which were guessed. A day is overloaded when the hours on it are more than the hours
# of a working day, or when there are any on a day off. Work still open from before the period is not hidden: it is
# counted as "earlier", on the person it is with.
class TeamSchedule
  MAX_DAYS = 14
  DEFAULT_HOURS = 1.0
  ROW_LIMIT = 1000
  EARLIER_LIMIT = 200
  HOURS_SQL = "SUM(COALESCE(estimated_hours, #{DEFAULT_HOURS}))".freeze

  def initialize(organization, from:, to:, today: Time.zone.today)
    @organization = organization
    @from = from
    @to = to
    @today = today
  end

  def call
    in_period = period_orders
    earlier = earlier_orders
    shown = in_period.first(ROW_LIMIT) + earlier.first(EARLIER_LIMIT)
    {
      from: @from.iso8601, to: @to.iso8601, today: @today.iso8601,
      days: days.map { |day| day.slice(:date, :working, :holiday, :hours) },
      technicians: people(shown).map { |person| row(person, in_period, earlier_totals[person.id]) },
      unassigned: row(nil, in_period, earlier_totals[nil]),
      work_orders: shown.map { |order| order_hash(order) },
      truncated: in_period.size > ROW_LIMIT || earlier.size > EARLIER_LIMIT
    }
  end

  private

  def settings = @settings ||= @organization.settings_with_defaults

  # Each day of the period with the hours it can hold: none on a day off or a holiday.
  def days
    @days ||= (@from..@to).map do |date|
      holiday = settings["holidays"].find { |h| holiday_on?(h, date) }
      working = settings["work_days"].include?(date.wday) && holiday.nil?
      { date: date.iso8601, working: working, holiday: holiday&.fetch("name"), hours: working ? working_hours : 0.0 }
    end
  end

  # A holiday is on its date, and on the same day of every year when it is marked as yearly.
  def holiday_on?(holiday, date)
    holiday["date"] == date.iso8601 || (holiday["repeating"] && holiday["date"].to_s[5..] == date.strftime("%m-%d"))
  end

  def working_hours
    start, finish = settings["work_hours"].values_at("start", "end").map { |t| t.split(":").then { |h, m| (h.to_i * 60) + m.to_i } }
    ((finish - start) / 60.0).round(2)
  end

  def open_work = @organization.work_orders.open.includes(:asset)

  def period_orders
    @period_orders ||= open_work.where(due_date: @from.in_time_zone.beginning_of_day..@to.in_time_zone.end_of_day)
                                .order(:due_date, :id).limit(ROW_LIMIT + 1).to_a
  end

  # What is still open from before the period, or has no date: the most recent of it to show, the rest counted.
  def earlier_scope = open_work.where("work_orders.due_date IS NULL OR work_orders.due_date < ?", @from.in_time_zone.beginning_of_day)

  def earlier_orders
    @earlier_orders ||= earlier_scope.order(Arel.sql("due_date DESC NULLS FIRST"), :id).limit(EARLIER_LIMIT + 1).to_a
  end

  # { assignee id (nil: nobody) => { count:, hours: } } for all of it, not just what is shown.
  def earlier_totals
    @earlier_totals ||= earlier_scope.except(:includes).group(:assignee_id)
                                     .pluck(:assignee_id, Arel.sql("COUNT(*)"), Arel.sql(HOURS_SQL))
                                     .to_h { |id, count, hours| [id, { count: count, hours: hours.to_f.round(2) }] }
                                     .tap { |totals| totals.default = { count: 0, hours: 0.0 } }
  end

  # Every technician, and anyone else who has work.
  def people(shown)
    others = shown.filter_map(&:assignee_id).uniq + earlier_totals.keys.compact
    @organization.users.active.where(role: "technician").or(@organization.users.active.where(id: others))
                 .order(:first_name, :last_name).to_a
  end

  def row(person, in_period, earlier)
    mine = in_period.select { |order| order.assignee_id == person&.id }
    by_day = mine.group_by { |order| day_of(order) }
    {
      id: person&.id, name: person&.full_name, role: person&.role,
      days: days.map { |day| load_on(day, by_day.fetch(day[:date], [])) },
      earlier: earlier
    }
  end

  def load_on(day, orders)
    hours = orders.sum { |order| hours(order) }.round(2)
    { date: day[:date], count: orders.size, hours: hours, overloaded: hours > day[:hours] }
  end

  def hours(order) = (order.estimated_hours || DEFAULT_HOURS).to_f

  def day_of(order) = order.due_date.in_time_zone.to_date.iso8601

  def order_hash(order)
    {
      id: order.id, work_order_number: order.work_order_number, title: order.title, priority: order.priority,
      status: order.status, assignee_id: order.assignee_id, day: order.due_date && day_of(order),
      hours: hours(order), estimated: !order.estimated_hours.nil?,
      asset: order.asset&.name
    }
  end
end
