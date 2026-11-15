# One sensor heading for a limit (Forecast::LimitTrend::Result). The range runs from the soonest the data allow to the latest.
class LimitForecastBlueprint < Blueprinter::Base
  field(:rule) { |result| { id: result.rule.id, name: result.rule.name } }
  field(:asset) do |result|
    asset = result.rule.asset
    { id: asset.id, name: asset.name, asset_tag: asset.asset_tag, location_path: asset.location&.full_path }
  end
  field(:metric_name) { |result| result.rule.metric_name }
  field(:unit) { |result| result.rule.unit }
  field(:limit) { |result| result.limit.round(2) }
  field(:current) { |result| result.current.round(2) }
  field(:slope_per_day) { |result| result.slope_per_day.round(3) }
  field(:days_left) { |result| result.days_left.round(1) }
  field(:days_soonest) { |result| result.days_soonest.round(1) }
  field(:days_latest) { |result| result.days_latest.round(1) }
  field(:reaches_on) { |result| (Time.current + result.days_left.days).to_date.iso8601 }
  field(:r2) { |result| result.r2.round(2) }
  fields :days_of_history, :points
end
