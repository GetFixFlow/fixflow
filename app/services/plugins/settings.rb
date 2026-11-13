module Plugins
  # What a company has done with the plugins installed on the server, kept on the organization (plugin_settings):
  #
  #   { "ntfy" => { "enabled" => true, "channels" => { "ntfy" => { "enabled" => true, "events" => [...], "values" => {...}, ... } } } }
  #
  # A plugin that is installed does nothing for a company until its administrator switches it on (Settings, Plugins): its reports
  # are hidden from the managers and its channels hear nothing. Settings for a plugin that is later removed from the server are
  # kept, so putting it back finds them as they were.
  class Settings
    def self.for(organization) = new(organization)

    def initialize(organization)
      @organization = organization
    end

    def enabled?(plugin_key) = data.dig(plugin_key.to_s, "enabled") == true

    def set_enabled(plugin_key, enabled)
      entry = data[plugin_key.to_s] || {}
      store(plugin_key, entry.merge("enabled" => enabled ? true : false))
    end

    def channel(plugin_key, channel_key)
      ChannelState.new(data.dig(plugin_key.to_s, "channels", channel_key.to_s))
    end

    # Applies form input to a channel and saves it. Returns the sentences that say why not, or [] when it was saved.
    def update_channel(channel, changes)
      state = channel(channel.plugin_key, channel.key).assign(channel, changes)
      problems = state.problems(channel)
      store_channel(channel, state) if problems.empty?
      problems
    end

    # Forgets how a channel was set up (and with it, its secrets).
    def forget_channel(channel)
      entry = data[channel.plugin_key] || {}
      store(channel.plugin_key, entry.merge("channels" => (entry["channels"] || {}).except(channel.key)))
    end

    # Bookkeeping after a delivery: no validation, no audit line. Kept apart from update_channel so a busy channel does not
    # rewrite the administrator's settings from stale values.
    def note(channel, changes)
      @organization.reload
      stored = channel(channel.plugin_key, channel.key).to_stored.merge(changes.transform_keys(&:to_s))
      entry = data[channel.plugin_key] || {}
      merged = entry.merge("channels" => (entry["channels"] || {}).merge(channel.key => stored))
      @organization.update_columns(plugin_settings: data.merge(channel.plugin_key => merged)) # rubocop:disable Rails/SkipsModelValidations
    end

    private

    def data = @organization.plugin_settings || {}

    def store_channel(channel, state)
      entry = data[channel.plugin_key] || {}
      store(channel.plugin_key, entry.merge("channels" => (entry["channels"] || {}).merge(channel.key => state.to_stored)))
    end

    def store(plugin_key, entry)
      @organization.update!(plugin_settings: data.merge(plugin_key.to_s => entry))
    end
  end
end
