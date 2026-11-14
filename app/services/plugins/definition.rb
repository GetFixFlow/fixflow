module Plugins
  # What a plugin says about itself, built by the block given to Plugins.define:
  #
  #   Plugins.define "ntfy" do
  #     title "ntfy"                      # the name on the Plugins screen
  #     version "1.0.0"
  #     summary "Sends notifications to an ntfy topic."
  #     author "The maintenance team"     # optional
  #     api 1                             # the Plugins::API_VERSION it was written for
  #
  #     report "late_jobs", title: "Late jobs", description: "...", period: true do |context| ... end
  #     channel "ntfy", title: "ntfy", fields: [{ key: "topic", label: "Topic", required: true }] do |message, settings| ... end
  #   end
  class Definition
    attr_reader :key, :source, :reports, :channels

    def self.build(key, source: nil, &block)
      definition = new(key, source)
      definition.instance_eval(&block) if block
      definition.validate!
      definition
    end

    def initialize(key, source)
      @key = key.to_s
      @source = source
      @reports = []
      @channels = []
      @api = nil
    end

    # Each of these reads when given nothing and writes when given a value, so a plugin file reads like a list of facts.
    def title(value = nil) = value ? @title = value.to_s : @title
    def version(value = nil) = value ? @version = value.to_s : @version
    def summary(value = nil) = value ? @summary = value.to_s : @summary
    def author(value = nil) = value ? @author = value.to_s : @author
    def api(value = nil) = value ? @api = value : @api

    def report(key, title:, description: nil, period: true, &block)
      raise Error, "report #{key.inspect} has no block to run" unless block
      raise Error, "report name #{key.inspect} must be lower-case letters, digits and _" unless key.to_s.match?(KEY_FORMAT)

      @reports << Report.new(plugin_key: @key, key: key.to_s, title: title.to_s, description: description.to_s,
                             period: period ? true : false, block: block)
    end

    def channel(key, title:, summary: nil, fields: [], &block)
      raise Error, "channel #{key.inspect} has no block to deliver with" unless block
      raise Error, "channel name #{key.inspect} must be lower-case letters, digits and _" unless key.to_s.match?(KEY_FORMAT)

      @channels << Channel.new(plugin_key: @key, key: key.to_s, title: title.to_s, summary: summary.to_s,
                               fields: Field.list(fields), block: block)
    end

    def find_report(name) = reports.find { |report| report.key == name.to_s }
    def find_channel(name) = channels.find { |channel| channel.key == name.to_s }

    def validate!
      unless key.match?(KEY_FORMAT)
        raise Error, "the name #{key.inspect} must be lower-case letters, digits and _ (2 to 40, starting with a letter)"
      end
      raise Error, "it has no title" if title.blank?
      raise Error, "it was written for plugin API #{api.inspect}, and this FixFlow offers #{API_VERSION}" unless api == API_VERSION
      raise Error, "it adds no report and no channel" if reports.empty? && channels.empty?

      [reports, channels].each { |list| validate_unique!(list) }
    end

    private

    def validate_unique!(list)
      names = list.map(&:key)
      duplicate = names.find { |name| names.count(name) > 1 }
      raise Error, "#{duplicate.inspect} is used twice" if duplicate
    end
  end
end
