require "net/http"
require "openssl"
require "timeout"

module Plugins
  # A place a plugin can send notifications. The block is given a Message and the settings the administrator filled in, and either
  # returns (sent) or raises Plugins::Refused (will never work: wrong address, revoked token) or Plugins::Unavailable (try
  # again later). Any other error counts as the plugin's own fault and is not retried.
  #
  #   channel "ntfy", title: "ntfy", fields: [{ key: "topic", label: "Topic", required: true }] do |message, settings|
  #     Plugins::Http.post("https://ntfy.sh/#{settings[:topic]}", body: message.body, headers: { "Title" => message.title })
  #   end
  class Channel < Data.define(:plugin_key, :key, :title, :summary, :fields, :block) # rubocop:disable Style/DataInheritance -- it has constants
    TIME_LIMIT = 30 # seconds
    NETWORK_ERRORS = [Net::OpenTimeout, Net::ReadTimeout, SocketError, SystemCallError, OpenSSL::SSL::SSLError, IOError].freeze

    def deliver(message, settings)
      Timeout.timeout(TIME_LIMIT) { block.call(message, settings) }
      true
    rescue Plugins::Error
      raise
    rescue *NETWORK_ERRORS => e
      raise Unavailable, "It could not be reached (#{e.class.name.demodulize})."
    rescue Timeout::Error
      raise Unavailable, "It did not answer within #{TIME_LIMIT} seconds."
    rescue StandardError => e
      Rails.logger.error "[Plugins] #{plugin_key}/#{key} failed: #{e.class}: #{e.message}\n#{e.backtrace&.first(8)&.join("\n")}"
      raise Refused, "The plugin failed (#{e.class.name}). The server log has the details."
    end

    def field(name) = fields.find { |field| field.key == name.to_s }
  end

  # One notification, as a channel is given it. `link` is a full address of the screen it is about (or nil).
  Message = Data.define(:event, :title, :body, :link, :company)
end
