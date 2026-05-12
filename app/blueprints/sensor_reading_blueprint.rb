class SensorReadingBlueprint < Blueprinter::Base
  identifier :id
  fields :metric_name, :value, :unit, :recorded_at, :asset_id, :metadata
end
