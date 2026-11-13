module Plugins
  # How one company has set up one plugin channel: switched on or off, which events it hears about, the values for the channel's
  # fields (secrets kept encrypted), and what happened last. Read and written through Plugins::Settings.
  class ChannelState
    attr_reader :enabled, :events, :last_sent_at, :last_error

    # The events a channel can be told about (the same ones the chat channel offers).
    def self.event_keys = ChatConfig::EVENTS.keys

    def initialize(stored = {})
      stored = (stored || {}).with_indifferent_access
      @enabled = stored[:enabled] == true
      @events = stored.key?(:events) ? Array(stored[:events]).map(&:to_s) : self.class.event_keys
      @values = (stored[:values] || {}).to_h.transform_keys(&:to_s)
      @secrets = (stored[:secrets] || {}).to_h.transform_keys(&:to_s)
      @last_sent_at = stored[:last_sent_at]
      @last_error = stored[:last_error]
    end

    def active_for?(event) = enabled && events.include?(event.to_s)

    def value(field) = @values[field.key]
    def secret_set?(field) = @secrets[field.key].present?

    # What a channel's block is given: every field by name, secrets in the clear, a field left empty as its default.
    def settings_for(channel)
      channel.fields.to_h do |field|
        plain = field.secret? ? PluginSecret.decrypt(@secrets[field.key]) : @values[field.key]
        [field.key, plain.presence || field.default]
      end.with_indifferent_access
    end

    # Changes from form input (see Plugins::Settings#update_channel). A blank secret means "keep the one saved".
    def assign(channel, changes)
      changes = changes.to_h.with_indifferent_access
      @enabled = changes[:enabled] ? true : false if changes.key?(:enabled)
      @events = Array(changes[:events]).map(&:to_s) if changes.key?(:events)
      given = (changes[:values] || {}).to_h.with_indifferent_access
      channel.fields.each { |field| assign_field(field, given[field.key]) if given.key?(field.key) }
      self
    end

    # Why this cannot be saved, as sentences (empty when it can).
    def problems(channel)
      problems = []
      unknown = events - self.class.event_keys
      problems << "Unknown events: #{unknown.join(', ')}." if unknown.any?
      channel.fields.each { |field| problems.concat(field_problems(field)) }
      problems
    end

    def to_stored
      { "enabled" => enabled, "events" => events, "values" => @values, "secrets" => @secrets,
        "last_sent_at" => last_sent_at, "last_error" => last_error }
    end

    # For the screen: the values without the secrets (only whether each secret is set).
    def to_screen(channel)
      { enabled: enabled, events: events, last_sent_at: last_sent_at, last_error: last_error,
        values: channel.fields.reject(&:secret?).to_h { |field| [field.key, @values[field.key].to_s] },
        secrets_set: channel.fields.select(&:secret?).to_h { |field| [field.key, secret_set?(field)] } }
    end

    private

    def assign_field(field, given)
      text = given.to_s.strip
      if field.secret?
        @secrets[field.key] = PluginSecret.encrypt(text) if text.present?
      elsif text.empty?
        @values.delete(field.key)
      else
        @values[field.key] = text
      end
    end

    def field_problems(field)
      present = field.secret? ? secret_set?(field) : @values[field.key].present?
      return ["#{field.label} is needed."] if field.required? && !present && enabled
      return [] unless present && !field.secret?

      text = @values[field.key]
      return ["#{field.label} is too long."] if text.length > Field::MAX_LENGTH

      kind_problems(field, text)
    end

    def kind_problems(field, text)
      if field.url?
        problem = WebhookAddress.problem(text)
        return problem ? ["#{field.label} #{problem}."] : []
      end
      return [] unless field.kind == "select" && field.options.exclude?(text)

      ["#{field.label} must be one of: #{field.options.join(', ')}."]
    end
  end
end
