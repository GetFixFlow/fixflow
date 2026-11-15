class SensorAnomalyBlueprint < Blueprinter::Base
  identifier :id

  fields :status, :metric_name, :unit, :recorded_at, :created_at, :acknowledged_at, :notes, :asset_id, :message

  %i[value usual_low usual_high usual_middle score].each { |name| field(name) { |anomaly| anomaly.public_send(name).to_f } }
  field :baseline_count

  field(:asset) { |anomaly| { id: anomaly.asset.id, name: anomaly.asset.name, asset_tag: anomaly.asset.asset_tag } }
  field(:location_path) { |anomaly| anomaly.asset.location&.full_path }
  field(:acknowledged_by) do |anomaly|
    anomaly.acknowledged_by ? { id: anomaly.acknowledged_by.id, full_name: anomaly.acknowledged_by.full_name } : nil
  end
end
