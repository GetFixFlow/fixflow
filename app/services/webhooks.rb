# Messages to the company's other systems when something happens here. A webhook is an address and a list of events; when
# one of its events happens, a delivery is made and sent (WebhookDeliveryJob), signed with the webhook's secret.
#
# What is sent is the same shape the public API answers with (PublicApi::*Blueprint), wrapped like this:
#   { "id": "evt_...", "event": "work_order.completed", "created_at": "...", "data": { "work_order": { ... } },
#     "changes": { "status": ["in_progress", "completed"] } }
module Webhooks
  EVENTS = {
    "work_order.created" => "A work order is created",
    "work_order.assigned" => "A work order is assigned to someone",
    "work_order.started" => "Work starts or starts again",
    "work_order.on_hold" => "A work order is put on hold",
    "work_order.pending_parts" => "A work order is waiting for parts",
    "work_order.completed" => "Work is finished",
    "work_order.verified" => "A manager verifies finished work",
    "work_order.cancelled" => "A work order is cancelled",
    "asset.created" => "An asset is added",
    "asset.status_changed" => "An asset's status changes (operational, degraded, down)",
    "iot_alert.created" => "A sensor alert is raised",
    "part.low_stock" => "A part falls to its reorder point or runs out"
  }.freeze

  module_function

  # Queues a delivery to every webhook of the company that listens to the event. Never raises: a receiver being down, or a
  # fault here, must not break what happened (the work order is still completed).
  def emit(organization, event, data, changes: nil)
    hooks = Webhook.unscoped.where(organization_id: organization.id).listening_to(event).to_a
    return if hooks.empty?

    event_id = "evt_#{SecureRandom.uuid}"
    payload = { id: event_id, event: event, created_at: Time.current.iso8601, data: data }
    payload[:changes] = changes if changes
    payload = JSON.parse(payload.to_json) # times and numbers as they will be sent, whatever the blueprints returned
    hooks.each do |hook|
      delivery = WebhookDelivery.create!(webhook: hook, organization: organization, event: event, event_id: event_id, payload: payload)
      WebhookDeliveryJob.perform_later(delivery.id)
    end
  rescue StandardError => e
    Rails.logger.error "[Webhooks] Could not queue #{event}: #{e.class} — #{e.message}"
  end

  def work_order(work_order, event, changes: nil)
    emit(work_order.organization, event, { work_order: PublicApi::WorkOrderBlueprint.render_as_hash(work_order) }, changes: changes)
  end

  def asset(asset, event, changes: nil)
    emit(asset.organization, event, { asset: PublicApi::AssetBlueprint.render_as_hash(asset) }, changes: changes)
  end

  def iot_alert(alert)
    emit(alert.asset.organization, "iot_alert.created", { iot_alert: PublicApi::IotAlertBlueprint.render_as_hash(alert) })
  end

  def part(part, kind)
    emit(part.organization, "part.low_stock", { part: PublicApi::PartBlueprint.render_as_hash(part) }, changes: { stock: kind.to_s })
  end

  # A test message to one webhook (not the company's other webhooks), so an address can be checked.
  def ping(webhook)
    event_id = "evt_#{SecureRandom.uuid}"
    payload = { id: event_id, event: "ping", created_at: Time.current.iso8601, data: { message: "This is a test from FixFlow." } }
    WebhookDelivery.create!(webhook: webhook, organization: webhook.organization, event: "ping", event_id: event_id, payload: payload)
  end
end
