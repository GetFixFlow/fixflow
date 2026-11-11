class WebhookDeliveryBlueprint < Blueprinter::Base
  identifier :id

  fields :webhook_id, :event, :event_id, :status, :attempts, :response_code, :response_excerpt, :error, :next_attempt_at,
         :delivered_at, :created_at
end
