class DowntimeBlueprint < Blueprinter::Base
  identifier :id
  fields :asset_id, :started_at, :ended_at, :reason

  field(:open, &:open?)
  # Hours it has lasted (so far, if it is still going on).
  field(:hours) { |downtime| downtime.hours_within(downtime.started_at, Time.current).round(2) }
  field(:started_by) { |downtime| downtime.started_by&.full_name }
  field(:ended_by) { |downtime| downtime.ended_by&.full_name }
end
