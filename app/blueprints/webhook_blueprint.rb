class WebhookBlueprint < Blueprinter::Base
  identifier :id

  fields :name, :url, :events, :active, :consecutive_failures, :disabled_at, :disabled_reason, :last_delivery_at, :created_at
  field(:enabled, &:enabled?)
  # The secret is never serialized here: it is sent once, beside the webhook, when it is made or renewed.
end
