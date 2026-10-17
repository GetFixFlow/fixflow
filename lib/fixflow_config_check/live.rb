require "socket"

class FixflowConfigCheck
  # Checks that what the settings point at answers: the database and Redis (which the server cannot run without), the
  # mail server (when one is set in the environment) and, as warnings, the file storage and the IoT broker.
  # `database` and `redis` are callables that raise when the service does not answer; `tcp` is called with (host, port).
  class Live
    TCP_TIMEOUT = 5

    def initialize(database:, redis:, env: ENV, tcp: method(:tcp_open?))
      @env = env
      @database = database
      @redis = redis
      @tcp = tcp
    end

    def problems
      [
        reach(:error, "DATABASE_URL", "the database", @database),
        reach(:error, "REDIS_URL", "Redis", @redis),
        mail, storage, broker
      ].compact
    end

    private

    def value(name) = @env[name].to_s.strip

    def reach(level, setting, what, check)
      check.call
      nil
    rescue StandardError => e
      first_line = e.message.to_s.lines.first.to_s.strip
      message = "#{what} did not answer (#{e.class}: #{first_line}). Is it running, and are the address and password right?"
      FixflowConfigCheck::Problem.new(level, setting, message)
    end

    def mail
      return if value("SMTP_HOST").empty? || FixflowConfigCheck.placeholder?(value("SMTP_PASSWORD"))

      port = value("SMTP_PORT").empty? ? 587 : value("SMTP_PORT").to_i
      reach(:error, "SMTP_HOST", "the mail server (#{value('SMTP_HOST')}:#{port})", -> { @tcp.call(value("SMTP_HOST"), port) })
    end

    def storage
      uri = URI.parse(value("MINIO_ENDPOINT"))
      return unless uri.host

      reach(:warning, "MINIO_ENDPOINT", "the file storage (MinIO)", -> { @tcp.call(uri.host, uri.port) })
    rescue URI::InvalidURIError
      nil
    end

    def broker
      return if value("MQTT_HOST").empty?

      port = value("MQTT_PORT").empty? ? 1883 : value("MQTT_PORT").to_i
      reach(:warning, "MQTT_HOST", "the MQTT broker (IoT)", -> { @tcp.call(value("MQTT_HOST"), port) })
    end

    def tcp_open?(host, port)
      Socket.tcp(host, port, connect_timeout: TCP_TIMEOUT, &:close)
    end
  end
end
