require "socket"
require "timeout"
require "fixflow_release"

# What an administrator needs to know to tell whether this install is working: the database, Redis, the background
# worker, email, the MQTT broker, file storage, and whether a newer release exists. Every check answers
# { status:, message:, ...facts } where status is "ok", "warning" (works, but needs attention), "error" (something that
# matters is down) or "off" (not set up, and that is fine). Counted live each time; nothing here changes anything.
class SystemHealth
  PROBE_TIMEOUT = 2
  BOOTED_AT = Time.current
  MQTT_OFF = { configured: false, broker: nil, reachable: nil, connected: nil, last_message_at: nil }.freeze
  NOT_CONNECTED = "The broker answers but FixFlow is not subscribed to it. The web server connects a few seconds after it " \
                  "starts and keeps retrying; if this stays, look for \"[MQTT]\" in the server log.".freeze

  def initialize(organization, env: ENV)
    @organization = organization
    @env = env
  end

  def call
    probes = start_probes
    checks = {
      database: database, redis: redis, background_jobs: BackgroundJobs.new.call,
      email: email(probes[:mail]), mqtt: mqtt(probes[:broker]), storage: storage
    }
    { status: overall(checks), checked_at: Time.current.iso8601, app: app_info, **checks, update: update }
  end

  private

  def check(status, message, **facts) = { status: status, message: message, **facts }

  def overall(checks)
    statuses = checks.values.pluck(:status)
    return "error" if statuses.include?("error")

    statuses.include?("warning") ? "warning" : "ok"
  end

  def version = FixflowRelease.current(@env)

  def app_info
    { version: version, environment: Rails.env, ruby: RUBY_VERSION, rails: Rails.version,
      uptime_seconds: (Time.current - BOOTED_AT).to_i }
  end

  def elapsed_ms(started) = ((Process.clock_gettime(Process::CLOCK_MONOTONIC) - started) * 1000).round(1)

  def started = Process.clock_gettime(Process::CLOCK_MONOTONIC)

  def reason(error) = "#{error.class.name.demodulize}: #{error.message.to_s.lines.first.to_s.strip}"

  # --- database and Redis ----------------------------------------------------------------------------------------

  def database
    begin_at = started
    connection = ActiveRecord::Base.connection
    connection.execute("SELECT 1")
    latency = elapsed_ms(begin_at)
    pending = connection.pool.migration_context.pending_migration_versions.size
    facts = { latency_ms: latency, server: connection.select_value("SHOW server_version").to_s, pending_migrations: pending }
    return check("ok", "The database answers.", **facts) if pending.zero?

    check("warning", "#{pending} database migration(s) have not been run. Run `bin/rails db:migrate`.", **facts)
  rescue StandardError => e
    check("error", "The database did not answer (#{reason(e)}). Nothing works without it.",
          latency_ms: nil, server: nil, pending_migrations: nil)
  end

  def redis_client
    Redis.new(url: @env.fetch("REDIS_URL", "redis://localhost:6379/0"), connect_timeout: PROBE_TIMEOUT, read_timeout: PROBE_TIMEOUT)
  end

  def redis
    client = redis_client
    begin_at = started
    client.ping
    latency = elapsed_ms(begin_at)
    info = client.info
    check("ok", "Redis answers.", latency_ms: latency, server: info["redis_version"], memory: info["used_memory_human"])
  rescue StandardError => e
    check("error", "Redis did not answer (#{reason(e)}). Background jobs and live updates need it.",
          latency_ms: nil, server: nil, memory: nil)
  end

  # --- email -----------------------------------------------------------------------------------------------------

  def email(probe)
    source = EmailSetup.source
    unless source
      return check("warning", "Email is not set up, so invitations, password resets and notifications are not sent. " \
                              "Set it up under Settings, Email.", source: nil, host: nil, port: nil, reachable: nil)
    end

    host, port = mail_server(source)
    reachable = probe&.value
    facts = { source: source.to_s, host: host, port: port, reachable: reachable }
    return check("error", "The mail server #{host}:#{port} did not answer.", **facts) if reachable == false

    check("ok", "Email is set up (#{source == :settings ? 'in Settings' : 'in the server\'s environment'}).", **facts)
  end

  def mail_server(source)
    if source == :settings
      config = EmailSetup.saved_config
      [config.host, config.port]
    else
      [@env["SMTP_HOST"], @env.fetch("SMTP_PORT", 587).to_i]
    end
  end

  # --- MQTT ------------------------------------------------------------------------------------------------------

  def mqtt(probe)
    state = mqtt_state
    host = @env["MQTT_HOST"].to_s
    # The subscriber tries localhost when MQTT_HOST is not set; if it got through, that is a broker in use.
    host = "localhost" if host.empty? && state[:connected]
    return check("off", "IoT over MQTT is not set up. Sensors can still send readings over HTTP.", **MQTT_OFF) if host.empty?

    port = @env.fetch("MQTT_PORT", 1883).to_i
    reachable = probe ? probe.value : state[:connected]
    facts = { configured: true, broker: "#{host}:#{port}", reachable: reachable, connected: state[:connected],
              last_message_at: state[:last_message_at]&.iso8601 }
    return check("error", "The MQTT broker #{host}:#{port} did not answer.", **facts) if reachable == false
    return check("warning", NOT_CONNECTED, **facts) unless state[:connected]

    check("ok", "FixFlow is connected to the MQTT broker.", **facts)
  end

  def mqtt_state
    Iot::MqttStatus.read
  rescue StandardError
    { connected: false, last_message_at: nil }
  end

  # --- file storage ----------------------------------------------------------------------------------------------

  def storage
    service = ActiveStorage::Blob.service.class.name.demodulize.delete_suffix("Service")
    Timeout.timeout(3) { ActiveStorage::Blob.service.exist?("fixflow_health_check") }
    check("ok", "File storage (#{service}) answers.", service: service)
  rescue StandardError => e
    check("warning", "File storage did not answer (#{reason(e)}), so photos and documents cannot be saved or opened.",
          service: service)
  end

  # --- update check ----------------------------------------------------------------------------------------------

  def update
    enabled = @organization.settings_with_defaults["update_check"]
    UpdateCheck.new(version: version, enabled: enabled, env: @env).call
  end

  # --- network probes, run side by side so a slow server does not make the page slow ---------------------------

  def start_probes
    { mail: mail_probe, broker: broker_probe }
  end

  def mail_probe
    source = EmailSetup.source
    return unless source

    host, port = mail_server(source)
    probe(host, port)
  end

  def broker_probe
    host = @env["MQTT_HOST"].to_s
    probe(host, @env.fetch("MQTT_PORT", 1883).to_i) unless host.empty?
  end

  def probe(host, port)
    Thread.new do
      Socket.tcp(host, port, connect_timeout: PROBE_TIMEOUT, &:close)
      true
    rescue StandardError
      false
    end
  end
end
