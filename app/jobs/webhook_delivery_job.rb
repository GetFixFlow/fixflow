# Sends one webhook delivery, and, when the receiver does not take it, tries again later (after 1 minute, 5 minutes, 30
# minutes, 2 hours, 6 hours: six attempts in all). A webhook whose deliveries keep giving up is switched off.
class WebhookDeliveryJob < ApplicationJob
  queue_as :notifications

  def perform(delivery_id)
    delivery = ActsAsTenant.without_tenant { WebhookDelivery.find_by(id: delivery_id) }
    return unless delivery&.status == "pending"

    webhook = delivery.webhook
    unless webhook.enabled? || delivery.event == "ping"
      return delivery.update!(status: "failed",
error: "The webhook was switched off or removed.")
    end

    record(delivery, WebhookSender.new(delivery).deliver)
  end

  private

  def record(delivery, result)
    delivery.attempts += 1
    delivery.assign_attributes(response_code: result.code, response_excerpt: result.excerpt, error: result.error)
    webhook = delivery.webhook
    if result.ok
      delivery.assign_attributes(status: "delivered", delivered_at: Time.current, next_attempt_at: nil)
      webhook.update_columns(consecutive_failures: 0, last_delivery_at: Time.current) # rubocop:disable Rails/SkipsModelValidations
    elsif result.gone || delivery.retry_delay.nil?
      delivery.assign_attributes(status: "failed", next_attempt_at: nil)
      gave_up(webhook, result)
    else
      delivery.next_attempt_at = delivery.retry_delay.from_now
    end
    delivery.save!
    self.class.set(wait_until: delivery.next_attempt_at).perform_later(delivery.id) if delivery.status == "pending"
  end

  def gave_up(webhook, result)
    webhook.update_columns(last_delivery_at: Time.current) # rubocop:disable Rails/SkipsModelValidations
    return webhook.disable!("The receiver answered 410 Gone, so FixFlow stopped sending to it.") if result.gone

    failures = webhook.consecutive_failures + 1
    webhook.update_columns(consecutive_failures: failures) # rubocop:disable Rails/SkipsModelValidations
    return unless failures >= Webhook::DISABLE_AFTER
    webhook.disable!("#{failures} messages in a row could not be delivered, so FixFlow stopped sending to it.")
  end
end
