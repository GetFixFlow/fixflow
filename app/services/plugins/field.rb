module Plugins
  # One thing an administrator fills in to set up a channel (a topic, an address, a token). The Plugins screen is drawn from
  # these, so a plugin needs no screen of its own.
  #
  #   { key: "topic", label: "Topic", kind: "text", required: true, help: "The part after the server's address." }
  #
  # kind: text (default), url (checked like a webhook address: https, or http on your own network, never this server),
  # secret (kept encrypted, never shown again, a blank entry keeps the saved one), select (needs options: [...]).
  class Field
    KINDS = %w[text url secret select].freeze
    MAX_LENGTH = 500

    attr_reader :key, :label, :kind, :help, :default, :options

    SETTINGS = %i[label kind required help default options].freeze

    def self.list(specs)
      fields = Array(specs).map do |spec|
        spec = spec.to_h.symbolize_keys
        raise Error, "a field has no key" if spec[:key].blank?

        new(**spec)
      end
      duplicate = fields.map(&:key).tally.find { |_key, count| count > 1 }&.first
      raise Error, "field #{duplicate.inspect} is used twice" if duplicate

      fields
    end

    def initialize(key:, **settings)
      unknown = settings.keys - SETTINGS
      raise Error, "field #{key} has an unknown setting: #{unknown.first.inspect} (use #{SETTINGS.join(', ')})" if unknown.any?

      @key = key.to_s
      @label = (settings[:label] || key.to_s.humanize).to_s
      @kind = (settings[:kind] || "text").to_s
      @required = settings[:required] ? true : false
      @help = settings[:help].to_s
      @default = settings[:default]
      @options = Array(settings[:options]).map(&:to_s)
      validate!
    end

    def required? = @required
    def secret? = kind == "secret"
    def url? = kind == "url"

    # What the screen is given. A secret's saved value is never part of it.
    def as_json(*)
      { key: key, label: label, kind: kind, required: required?, help: help, default: default, options: options }
    end

    private

    def validate!
      raise Error, "field name #{key.inspect} must be lower-case letters, digits and _" unless key.match?(KEY_FORMAT)
      raise Error, "field #{key} has the unknown kind #{kind.inspect} (use #{KINDS.join(', ')})" unless KINDS.include?(kind)
      raise Error, "field #{key} is a select and needs options" if kind == "select" && options.empty?
    end
  end
end
