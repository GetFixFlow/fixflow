class MeterReadingBlueprint < Blueprinter::Base
  identifier :id
  fields :meter_id, :recorded_at, :source, :reset, :note

  field(:value)       { |reading| reading.value.to_f }
  field(:recorded_by) { |reading| reading.recorded_by&.full_name }
end
