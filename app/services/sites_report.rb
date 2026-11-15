# The sites side by side, for a manager or administrator: how many assets, how much work is open and overdue, what finished in the
# period and what it cost, how available the assets were, and how many people work there. A row for each site, one for what is in
# no site (shared by every site), and the total. A person who works at some sites only (see SiteAccess) is shown those sites and
# the shared ones, because the models they are worked out from are already limited to them.
#
# The figures are the ones the other reports use: cost is what finished work cost (CostReport), availability and downtime come from
# DowntimeReport, work is a work order's asset's site, and work with no asset is in no site.
class SitesReport
  def initialize(organization, from:, to:)
    @organization = organization
    @from = from
    @to = to
  end

  def call
    sites = @organization.locations.sites.order(:name).to_a
    rows = sites.map { |site| row(site.id, site.name, assets_in(site.subtree_ids), people_at(site)) }
    rows << row(nil, nil, shared_assets(sites), nil, shared: true)
    { period: { from: @from.to_date.iso8601, to: @to.to_date.iso8601 }, sites: rows.first(rows.size - 1), shared: rows.last,
total: total(rows) }
  end

  private

  def assets_in(place_ids) = Asset.kept.where(organization_id: @organization.id, location_id: place_ids)

  # Assets in a place that is in no site, or in none at all.
  def shared_assets(sites)
    in_sites = sites.flat_map(&:subtree_ids)
    scope = Asset.kept.where(organization_id: @organization.id)
    in_sites.empty? ? scope : scope.where(location_id: nil).or(scope.where.not(location_id: in_sites))
  end

  def row(id, name, assets, people, shared: false)
    work = WorkOrder.where(organization_id: @organization.id, asset_id: assets.select(:id))
    work = work.or(WorkOrder.where(organization_id: @organization.id, asset_id: nil)) if shared
    finished = work.where(status: %w[completed verified], completed_at: @from..@to)
    { id: id, name: name, assets: assets.count, open_work_orders: work.open.count, overdue_work_orders: work.overdue.count,
      completed_work_orders: finished.count, total_cost: cost(finished), people: people }.merge(availability(assets))
  end

  def cost(finished)
    sums = "COALESCE(SUM(labor_cost), 0), COALESCE(SUM(parts_cost), 0), COALESCE(SUM(vendor_cost), 0)"
    finished.pick(Arel.sql(sums)).sum.to_f.round(2)
  end

  def availability(assets)
    summary = DowntimeReport.new(assets, from: @from, to: @to).call[:summary]
    summary.slice(:availability, :downtime_hours, :failures)
  end

  def people_at(site) = site.site_memberships.count

  def total(rows)
    counts = %i[assets open_work_orders overdue_work_orders completed_work_orders failures]
    sums = counts.index_with { |key| rows.sum { |one| one[key] } }
    sums.merge(total_cost: rows.sum { |one| one[:total_cost] }.round(2),
               downtime_hours: rows.sum { |one| one[:downtime_hours] }.round(1))
  end
end
