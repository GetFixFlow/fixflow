class IotAlertBlueprint < Blueprinter::Base
  identifier :id

  fields :status, :metric_name, :triggered_value, :threshold, :operator,
    :acknowledged_at, :resolved_at, :notes, :created_at, :asset_id, :iot_rule_id, :work_order_id,
    :severity, :message, :duration_minutes

  # The names the screens read, for the same values.
  field(:sensor_value)        { |alert| alert.triggered_value.to_f }
  field(:threshold_value)     { |alert| alert.threshold.to_f }
  field :operator, name: :threshold_operator
  field(:metric_unit)         { |alert| alert.iot_rule.unit }
  field(:rule_name)           { |alert| alert.iot_rule.name }
  field(:work_order_number)   { |alert| alert.work_order&.work_order_number }
  field(:location_path)       { |alert| alert.asset.location&.full_path }
  field(:acknowledged_note)   { |alert| alert.notes if alert.acknowledged? }
  field(:resolved_note)       { |alert| alert.notes if alert.resolved? }

  field(:asset) do |alert|
    { id: alert.asset.id, name: alert.asset.name, asset_tag: alert.asset.asset_tag }
  end

  field(:work_order) do |alert|
    if alert.work_order
      { id: alert.work_order.id, number: alert.work_order.work_order_number, status: alert.work_order.status }
    end
  end

  field(:acknowledged_by) do |alert|
    alert.acknowledged_by ? { id: alert.acknowledged_by.id, full_name: alert.acknowledged_by.full_name } : nil
  end

  field(:iot_rule) do |alert|
    { id: alert.iot_rule.id, name: alert.iot_rule.name }
  end
end
