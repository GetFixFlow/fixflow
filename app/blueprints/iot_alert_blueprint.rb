class IotAlertBlueprint < Blueprinter::Base
  identifier :id

  fields :status, :metric_name, :triggered_value, :threshold, :operator,
    :acknowledged_at, :resolved_at, :notes, :created_at

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
