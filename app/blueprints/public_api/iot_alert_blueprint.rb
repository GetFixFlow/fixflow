module PublicApi
  class IotAlertBlueprint < Blueprinter::Base
    identifier :id

    fields :status, :metric_name, :operator, :work_order_id, :created_at
    field(:threshold) { |alert| alert.threshold.to_f }
    field(:triggered_value) { |alert| alert.triggered_value.to_f }
    field(:severity, &:severity)
    field(:asset) { |alert| { id: alert.asset.id, name: alert.asset.name, asset_tag: alert.asset.asset_tag } }
    field(:url) { |_alert| "#{EmailSetup.base_url}/iot/alerts" }
  end
end
