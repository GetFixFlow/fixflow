module Iot
  # What the MQTT subscriber (a thread inside the web server) tells the rest of the app, through Redis, so the admin
  # health page can say whether FixFlow is connected to the broker and when it last heard from it. The "connected"
  # note expires on its own (the subscriber renews it every 30 seconds), so a crashed server does not stay "connected".
  # Never raises: reporting a status must not break receiving readings.
  module MqttStatus
    CONNECTED_KEY = "fixflow:mqtt:connected".freeze
    LAST_MESSAGE_KEY = "fixflow:mqtt:last_message_at".freeze
    CONNECTED_TTL = 90
    MESSAGE_WRITE_EVERY = 10 # seconds: a busy broker should not mean a Redis write for every reading

    class << self
      def connected! = write { |redis| redis.set(CONNECTED_KEY, Time.current.iso8601, ex: CONNECTED_TTL) }

      def disconnected! = write { |redis| redis.del(CONNECTED_KEY) }

      def message_received!
        now = Process.clock_gettime(Process::CLOCK_MONOTONIC)
        return if @last_written && now - @last_written < MESSAGE_WRITE_EVERY

        @last_written = now
        write { |redis| redis.set(LAST_MESSAGE_KEY, Time.current.iso8601) }
      end

      # { connected: true/false, last_message_at: Time or nil }
      def read
        redis = Redis.new(url: ENV.fetch("REDIS_URL", "redis://localhost:6379/0"), connect_timeout: 2, read_timeout: 2)
        last = redis.get(LAST_MESSAGE_KEY)
        { connected: redis.exists?(CONNECTED_KEY), last_message_at: last && Time.zone.parse(last) }
      end

      private

      def write
        yield Redis.new(url: ENV.fetch("REDIS_URL", "redis://localhost:6379/0"), connect_timeout: 2, read_timeout: 2)
      rescue StandardError => e
        Rails.logger.warn "[MQTT] Could not record status: #{e.message}"
      end
    end
  end
end
