# Sends one notification through one plugin channel. Its own job, so that nothing waits for a plugin or the service behind it,
# and so that a service that is briefly down is tried again. What happened last is kept on the channel's settings, for the
# administrator to see on the Plugins screen.
class PluginChannelJob < ApplicationJob
  queue_as :notifications

  # A busy sensor can raise many alerts in a minute: past this many in a minute the rest are dropped (and logged).
  PER_MINUTE = 20
  ATTEMPTS = 3

  retry_on Plugins::Unavailable, wait: 30.seconds, attempts: ATTEMPTS do |job, error|
    job.record_failure(error.message)
  end
  discard_on Plugins::Refused do |job, error|
    job.record_failure(error.message)
  end

  # message: { title:, body:, link: } (a hash, so the list of arguments stays short)
  def perform(organization_id, plugin_key, channel_key, event, message)
    @organization = Organization.find_by(id: organization_id)
    @channel = Plugins.channel(plugin_key, channel_key)
    return unless @organization && @channel

    settings = Plugins::Settings.for(@organization)
    state = settings.channel(plugin_key, channel_key)
    return unless settings.enabled?(plugin_key) && state.active_for?(event)
    return drop(event) if over_limit?

    content = message.to_h.symbolize_keys
    delivered = Plugins::Message.new(event: event, title: content[:title], body: content[:body], link: content[:link],
company: @organization.name)
    @channel.deliver(delivered, state.settings_for(@channel))
    settings.note(@channel, last_sent_at: Time.current.iso8601, last_error: nil)
  end

  # The last try failed (or the service refused): keep the reason where the administrator can read it.
  def record_failure(reason)
    organization = @organization || Organization.find_by(id: arguments.first)
    channel = @channel || Plugins.channel(arguments[1], arguments[2])
    return unless organization && channel

    Plugins::Settings.for(organization).note(channel, last_error: reason.to_s.truncate(300))
  end

  private

  def drop(event)
    Rails.logger.warn "[Plugins] More than #{PER_MINUTE} messages a minute through " \
                      "#{@channel.plugin_key}/#{@channel.key}: #{event} dropped"
  end

  def over_limit?
    key = "plugins/#{@organization.id}/#{@channel.plugin_key}/#{@channel.key}/#{Time.current.strftime('%Y%m%d%H%M')}"
    count = Rails.cache.increment(key, 1, expires_in: 2.minutes)
    count.present? && count > PER_MINUTE
  end
end
