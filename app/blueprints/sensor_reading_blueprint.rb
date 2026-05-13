class SensorReadingBlueprint < Blueprinter::Base
  identifier :id

  fields :asset_id, :metric_name, :value, :unit, :source,
    :device_id, :quality, :recorded_at, :received_at
end
