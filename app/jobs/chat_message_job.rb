# Posts one message to the company's chat. Its own job, so that nothing waits for a chat service, and so that a service that is
# briefly down is tried again. What happened last is kept on the settings, for the administrator to see.
class ChatMessageJob < ApplicationJob
  queue_as :notifications

  # A busy sensor can raise many alerts in a minute: past this many in a minute the rest are dropped (and logged), so a
  # channel is not buried and a webhook is not rate-limited into refusing the important ones.
  PER_MINUTE = 20
  ATTEMPTS = 3

  retry_on ChatDelivery::Unavailable, wait: 30.seconds, attempts: ATTEMPTS do |job, error|
    job.record_failure(error.message)
  end
  discard_on ChatDelivery::Refused do |job, error|
    job.record_failure(error.message)
  end

  def perform(organization_id, event, title, body, link)
    organization = Organization.find_by(id: organization_id)
    config = organization&.chat_config
    return unless config&.active_for?(event)

    if over_limit?(organization)
      Rails.logger.warn "[Chat] More than #{PER_MINUTE} messages this minute for organization #{organization.id}: #{event} dropped"
      return
    end

    @organization = organization
    ChatDelivery.new(config).deliver(ChatMessage::Content.new(title: title, body: body, link: link))
    record(last_sent_at: Time.current.iso8601, last_error: nil)
  end

  # The last try failed (or the webhook refused): keep the reason where the administrator can read it.
  def record_failure(reason)
    organization = @organization || Organization.find_by(id: arguments.first)
    return unless organization

    @organization = organization
    record(last_error: reason.to_s.truncate(300))
  end

  private

  def over_limit?(organization)
    count = Rails.cache.increment("chat/#{organization.id}/#{Time.current.strftime('%Y%m%d%H%M')}", 1, expires_in: 2.minutes)
    count.present? && count > PER_MINUTE
  end

  def record(changes)
    @organization.update_columns(chat_settings: @organization.chat_settings.merge(changes.transform_keys(&:to_s))) # rubocop:disable Rails/SkipsModelValidations
  end
end
