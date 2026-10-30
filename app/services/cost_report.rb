# What finished work cost, from the labor, parts and vendor costs recorded on each work order.
#
# A cost counts in the period the work was finished (completed or verified, by the completion date), not
# when the work order was opened, so a job opened last month and finished today is today's cost.
class CostReport
  OTHER = "Other".freeze
  SUMS = "COALESCE(SUM(work_orders.labor_cost), 0), COALESCE(SUM(work_orders.parts_cost), 0), " \
         "COALESCE(SUM(work_orders.vendor_cost), 0), COUNT(*)".freeze
  TREEMAP_ITEMS = 12
  TOP_ASSETS = 20
  # What costs can be grouped by: the SQL for each is fixed here, never built from anything passed in.
  GROUPINGS = { asset: "work_orders.asset_id", location: "assets.location_id" }.freeze

  # `work_orders` is the company's work orders, with any filters already applied.
  def initialize(work_orders, from:, to:)
    @scope = work_orders.where(status: %w[completed verified], completed_at: from..to)
    @from = from
    @to = to
  end

  def summary(group_by)
    # A filter that matches nothing gives an empty relation, which has no row to pick: that is zeros.
    labor, parts, vendor, count = @scope.pick(Arel.sql(SUMS)) || [0, 0, 0, 0]
    total = labor + parts + vendor
    {
      total_cost: money(total), labor_cost: money(labor), parts_cost: money(parts), vendor_cost: money(vendor),
      work_orders_count: count, avg_cost_per_wo: count.zero? ? 0.0 : money(total / count),
      group_by: group_by, trend: trend(group_by)
    }
  end

  def by_asset
    list = asset_rows
    { assets: list.first(TOP_ASSETS), treemap: treemap(list), total_assets: list.size }
  end

  # Every asset that cost something, dearest first (the screen shows only the top few).
  def asset_rows
    rows = grouped_costs(:asset)
    names = Asset.unscoped.where(id: rows.keys.compact).pluck(:id, :name).to_h
    list = rows.map { |asset_id, row| row.merge(asset_id: asset_id, asset_name: names[asset_id] || "No asset") }
    list.sort_by { |row| -row[:total_cost] }
  end

  def by_location
    { locations: location_rows }
  end

  # What each vendor charged for the work finished in the period, dearest first.
  def by_vendor
    { vendors: vendor_rows }
  end

  def vendor_rows
    rows = @scope.where.not(vendor_id: nil).group(:vendor_id).pluck(:vendor_id, Arel.sql("COALESCE(SUM(vendor_cost), 0), COUNT(*)"))
    names = Vendor.unscoped.where(id: rows.map(&:first)).pluck(:id, :name).to_h
    list = rows.map { |id, cost, count| { vendor_id: id, vendor_name: names[id], vendor_cost: money(cost), wo_count: count } }
    list.sort_by { |row| [-row[:vendor_cost], row[:vendor_name].to_s] }
  end

  def location_rows
    rows = grouped_costs(:location)
    names = Location.unscoped.where(id: rows.keys.compact).to_h { |location| [location.id, location.full_path] }
    list = rows.map { |location_id, row| row.merge(location_id: location_id, location_name: names[location_id] || "No location") }
    list.sort_by { |row| -row[:total_cost] }
  end

  private

  # { key => { labor_cost:, parts_cost:, vendor_cost:, total_cost:, wo_count: } }
  def grouped_costs(by)
    column = GROUPINGS.fetch(by)
    scope = by == :location ? @scope.left_joins(:asset) : @scope
    rows = scope.group(column).pluck(Arel.sql(column), Arel.sql(SUMS))
    rows.to_h do |key, labor, parts, vendor, count|
      [key, { labor_cost: money(labor), parts_cost: money(parts), vendor_cost: money(vendor),
              total_cost: money(labor + parts + vendor), wo_count: count }]
    end
  end

  def treemap(list)
    paying = list.select { |row| row[:total_cost].positive? }
    top = paying.first(TREEMAP_ITEMS).map { |row| { name: row[:asset_name], cost: row[:total_cost] } }
    rest = paying.drop(TREEMAP_ITEMS).sum { |row| row[:total_cost] }
    rest.positive? ? top + [{ name: OTHER, cost: money(rest) }] : top
  end

  # One point per day, week (starting Monday) or month in the period, empty ones included so the chart has no gaps.
  def trend(group_by)
    unit = %w[week month].include?(group_by) ? group_by : "day"
    bucket = "DATE_TRUNC('#{unit}', work_orders.completed_at)::date"
    found = @scope.group(Arel.sql(bucket)).pluck(Arel.sql("#{bucket}, #{SUMS}")).index_by(&:first)
    bucket_starts(unit).map do |date|
      _, labor, parts, vendor, count = found[date] || [date, 0, 0, 0, 0]
      { period: date.iso8601, labor: money(labor), parts: money(parts), vendor: money(vendor),
        total: money(labor + parts + vendor), wo_count: count }
    end
  end

  def bucket_starts(unit)
    first = @from.to_date
    first = first.beginning_of_week if unit == "week"
    first = first.beginning_of_month if unit == "month"
    dates = []
    date = first
    while date <= @to.to_date && dates.size < 400
      dates << date
      date = { "day" => date + 1, "week" => date + 7, "month" => date.next_month }.fetch(unit)
    end
    dates
  end

  def money(value) = value.to_d.round(2).to_f
end
