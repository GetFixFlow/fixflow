module Plugins
  # Hands an event to the notification channels plugins add. ChatNotifier.post, which every place that announces something
  # already calls, calls this too, so a plugin's channel hears what chat hears and nothing in the core needed to change.
  module Channels
    module_function

    # Queues one PluginChannelJob for each channel of each plugin the company has on and that wants this event. Never raises: a
    # plugin must not break the thing that caused the notification.
    def post(organization, event, title:, body: nil, link: nil)
      return if organization.nil? || Plugins.installed.empty?

      settings = Settings.for(organization)
      Plugins.installed.each do |plugin|
        next unless settings.enabled?(plugin.key)

        plugin.channels.each do |channel|
          next unless settings.channel(plugin.key, channel.key).active_for?(event)

          PluginChannelJob.perform_later(organization.id, plugin.key, channel.key, event.to_s,
                                         { title: title.to_s, body: body.to_s, link: link })
        end
      end
    rescue StandardError => e
      Rails.logger.error "[Plugins] Could not queue #{event}: #{e.class} — #{e.message}"
    end

    # One message through one channel now (the Test button). Raises Plugins::Refused or Plugins::Unavailable.
    def test(organization, channel, state, person)
      message = Message.new(event: "test", title: "FixFlow is connected", company: organization.name, link: EmailSetup.base_url,
                            body: "This is a test message from #{person.full_name}.")
      channel.deliver(message, state.settings_for(channel))
    end
  end
end
