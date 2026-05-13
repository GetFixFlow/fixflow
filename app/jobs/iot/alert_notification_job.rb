module Iot
  class AlertNotificationJob < ApplicationJob
    queue_as :notifications

    def perform(iot_alert_id)
      alert = IotAlert.includes(:iot_rule, :asset, :work_order).find_by(id: iot_alert_id)
      return unless alert

      broadcast_alert(alert)
    end

    private

    def broadcast_alert(alert)
      ActionCable.server.broadcast(
        "iot_channel_asset_#{alert.asset_id}",
        {
          type:           "alert",
          alert_id:       alert.id,
          asset_id:       alert.asset_id,
          metric:         alert.metric_name,
          value:          alert.triggered_value,
          threshold:      alert.threshold,
          operator:       alert.operator,
          priority:       alert.iot_rule.wo_priority,
          work_order_id:  alert.work_order_id
        }
      )
    end
  end
end
