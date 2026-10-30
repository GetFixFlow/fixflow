class MeterBlueprint < Blueprinter::Base
  identifier :id
  fields :asset_id, :name, :unit, :sensor_metric, :last_reading_at, :created_at, :updated_at

  # Decimal columns are sent as numbers, not the strings Rails would use.
  field(:reading) { |meter| meter.reading.to_f }
end
