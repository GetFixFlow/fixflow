require "mqtt"

module Iot
  class MqttSubscriberService
    TOPIC_PATTERN = /\Afixflow\/(?<org_token>[^\/]+)\/(?:assets\/(?<asset_id>[^\/]+)\/)?telemetry\z/

    class << self
      def start
        @running = true
        connect_with_backoff
      end

      def stop
        @running = false
        @client&.disconnect
        Rails.logger.info "[MQTT] Subscriber stopped"
      end

      def process_message(topic, payload)
        match = TOPIC_PATTERN.match(topic)
        return unless match

        org_token  = match[:org_token]
        asset_hint = match[:asset_id]

        data = JSON.parse(payload)
        organization = Organization.find_by(subdomain: org_token)

        unless organization
          Rails.logger.warn "[MQTT] Unknown org token: #{org_token}"
          return
        end

        if data["readings"].is_a?(Array)
          process_bulk(organization, data, asset_hint)
        else
          process_single(organization, data, asset_hint)
        end
      rescue JSON::ParserError => e
        Rails.logger.error "[MQTT] Malformed JSON on #{topic}: #{e.message}"
      rescue => e
        Rails.logger.error "[MQTT] Error processing #{topic}: #{e.message}"
      end

      private

      def connect_with_backoff
        backoff = 1

        loop do
          break unless @running

          begin
            @client = build_client
            @client.connect do |c|
              Rails.logger.info "[MQTT] Connected to #{mqtt_host}:#{mqtt_port}"
              backoff = 1
              c.subscribe("fixflow/#")

              c.get do |topic, payload|
                process_message(topic, payload)
              end
            end
          rescue MQTT::Exception, Errno::ECONNREFUSED, SocketError => e
            Rails.logger.error "[MQTT] Connection error: #{e.message}. Reconnecting in #{backoff}s"
            sleep backoff
            backoff = [backoff * 2, 60].min
            retry if @running
          end
        end
      end

      def build_client
        MQTT::Client.new(
          host:      mqtt_host,
          port:      mqtt_port,
          username:  ENV["MQTT_USERNAME"],
          password:  ENV["MQTT_PASSWORD"],
          ssl:       ENV["MQTT_SSL"] == "true",
          keep_alive: ENV.fetch("MQTT_KEEPALIVE", 60).to_i
        )
      end

      def mqtt_host = ENV.fetch("MQTT_HOST", "localhost")
      def mqtt_port = ENV.fetch("MQTT_PORT", 1883).to_i

      def process_single(organization, data, asset_hint)
        identifier = data["asset_id"] || asset_hint
        asset = find_asset(organization, identifier)
        return log_unknown_asset(identifier) unless asset

        Iot::IngestionService.ingest(
          asset,
          [data.slice("metric", "value", "unit", "device_id", "timestamp")],
          source: :mqtt,
          device_id: data["device_id"]
        )
      end

      def process_bulk(organization, data, asset_hint)
        identifier = data["asset_id"] || asset_hint
        asset = find_asset(organization, identifier)
        return log_unknown_asset(identifier) unless asset

        readings = data["readings"].map do |r|
          r.merge("device_id" => data["device_id"], "timestamp" => data["timestamp"])
        end

        Iot::IngestionService.ingest(asset, readings, source: :mqtt, device_id: data["device_id"])
      end

      def find_asset(organization, identifier)
        return nil if identifier.blank?
        organization.assets.find_by(id: identifier) ||
          organization.assets.find_by(asset_tag: identifier)
      end

      def log_unknown_asset(identifier)
        Rails.logger.warn "[MQTT] Unknown asset: #{identifier}"
      end
    end
  end
end
