# Nightly: removes records of webhook messages older than 30 days (the message and what the receiver answered).
class WebhookCleanupJob < ApplicationJob
  queue_as :scheduled

  def perform
    ActsAsTenant.without_tenant { WebhookDelivery.old.in_batches(of: 5_000).delete_all }
  end
end
