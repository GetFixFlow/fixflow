# How much of a period each asset was available, how often it failed, and how long it ran between failures and took to
# come back, worked out from its downtimes (AssetDowntime).
#
#   availability  = hours it ran / hours it existed in the period
#   failures      = stops that began in the period
#   MTBF          = hours it ran / failures            (mean time between failures; none without a failure)
#   MTTR          = hours down in those stops / failures (mean time to restore)
#
# An asset counts from the day it was added, and to now at the latest, so a young asset or the current month is not
# credited with time that has not happened.
class DowntimeReport
  ROW_LIMIT = 500

  # The raw figures of one asset (or, added up, of all): hours in the period, hours down, stops, hours down in those stops.
  Measure = Struct.new(:window, :down, :failures, :restore) do
    def +(other) = Measure.new(window + other.window, down + other.down, failures + other.failures, restore + other.restore)

    def to_h
      up = [window - down, 0].max
      {
        availability: window.positive? ? (up / window * 100).round(2) : 100.0,
        downtime_hours: down.round(1), failures: failures,
        mtbf_hours: failures.positive? ? (up / failures).round(1) : nil,
        mttr_hours: failures.positive? ? (restore / failures).round(1) : nil
      }
    end
  end

  def initialize(assets, from:, to:, now: Time.current)
    @assets = assets
    @from = from
    @to = [to, now].min
    @now = now
  end

  def call
    measured = assets_in_period.map { |asset, start| [asset, measure(asset, start)] }
    rows = measured.map { |asset, measure| row(asset, measure) }.sort_by { |row| [row[:availability], row[:name].to_s.downcase] }
    { period: { from: @from.to_date.iso8601, to: @to.to_date.iso8601 }, summary: summary(measured, rows),
      assets: rows.first(ROW_LIMIT) }
  end

  private

  # The assets that existed in the period, with the moment each began to count in it. Decommissioned ones are retired,
  # not unavailable.
  def assets_in_period
    @assets.kept.where.not(status: "decommissioned").includes(:location).filter_map do |asset|
      start = [@from, asset.created_at].max
      [asset, start] if start < @to
    end
  end

  def downtimes_by_asset
    @downtimes_by_asset ||= AssetDowntime.where(asset_id: @assets.select(:id)).during(@from, @to).group_by(&:asset_id)
  end

  def measure(asset, start)
    downtimes = downtimes_by_asset.fetch(asset.id, [])
    stops = downtimes.select { |downtime| downtime.started_at >= start }
    Measure.new((@to - start) / 1.hour, downtimes.sum(0.0) { |downtime| downtime.hours_within(start, @to, now: @now) }, stops.size,
                stops.sum(0.0) { |downtime| downtime.hours_within(start, @to, now: @now) })
  end

  def row(asset, measure)
    measure.to_h.merge(id: asset.id, name: asset.name, asset_tag: asset.asset_tag, location: asset.location&.name,
                       down_now: asset.status == "down")
  end

  def summary(measured, rows)
    total = measured.map(&:last).reduce(Measure.new(0.0, 0.0, 0, 0.0), :+)
    total.to_h.merge(assets: rows.size, down_now: rows.count { |row| row[:down_now] })
  end
end
