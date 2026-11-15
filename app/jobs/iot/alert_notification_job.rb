module Iot
  class AlertNotificationJob < ApplicationJob
    queue_as :notifications

    def perform(iot_alert_id)
      alert = IotAlert.includes(:iot_rule, :work_order, :acknowledged_by, asset: :location).find_by(id: iot_alert_id)
      return unless alert

      broadcast_alert(alert)
      broadcast_to_company(alert)
      post_to_chat(alert)
    end

    private

    # The serious ones, as the live toasts show them: a channel is for what someone should look at now.
    def post_to_chat(alert)
      return unless %w[critical high].include?(alert.severity)

      ChatNotifier.post(alert.asset.organization, "iot_alert", title: "#{alert.severity.capitalize} sensor alert: #{alert.asset.name}",
                                                              body: alert.message, path: "/iot")
    end

    # The IoT screens' live feed: the alert as the alert list shows it.
    def broadcast_to_company(alert)
      payload = { alert: IotAlertBlueprint.render_as_hash(alert) }
      organization_id = alert.asset.organization_id
      ActionCable.server.broadcast(IotAlertChannel.stream_for_company(organization_id), payload)
      # And the site's own stream, which is what a person who works at some sites only listens to.
      site_id = SiteAccess.site_id_for(alert.asset.location)
      ActionCable.server.broadcast(IotAlertChannel.stream_for_site(organization_id, site_id), payload)
    end

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
