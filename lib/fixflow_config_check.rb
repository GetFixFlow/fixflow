require "uri"
require_relative "fixflow_config_check/file_storage"
require_relative "fixflow_config_check/https"

# Looks at the server's settings (its environment variables) before it starts, so a mistake stops the start with a
# plain message instead of a stack trace later, or a server that runs with an example password.
#
# `error?` problems stop the start; the others are printed and the start goes on. This part needs no network (see
# FixflowConfigCheck::Live for checking that what the settings point at answers). Plain Ruby, so it can run before
# Rails has loaded.
class FixflowConfigCheck
  include FileStorage
  include Https

  Problem = Struct.new(:level, :setting, :message) do
    def error? = level == :error
  end

  # What .env.example and the docs put in a setting as a stand-in for a real value.
  PLACEHOLDER = /change[_-]?me|\Ayour[_-]|\Apassword\z|\Asecret\z|\Aexample/i
  SECRET_KEY_BASE_MIN = 64
  JWT_SECRET_MIN = 32

  def initialize(env = ENV)
    @env = env
  end

  def problems
    @problems ||= [
      secret("SECRET_KEY_BASE", SECRET_KEY_BASE_MIN, "bin/rails secret"),
      secret("DEVISE_JWT_SECRET_KEY", JWT_SECRET_MIN, "openssl rand -base64 64"),
      database_url, redis_url, app_url, allowed_origins, smtp_settings, minio_settings, mqtt_settings, feature_settings,
      https_settings
    ].flatten.compact
  end

  def errors = problems.select(&:error?)

  # The problems as text for a terminal: errors first, each with the setting and what to do about it.
  def self.report(problems)
    return "" if problems.empty?

    lines = problems.sort_by { |problem| problem.error? ? 0 : 1 }.map do |problem|
      "  #{problem.error? ? 'ERROR  ' : 'warning'} #{problem.setting}: #{problem.message}"
    end
    footer = "The server was not started. Fix the errors above (see .env.example) and start it again." if problems.any?(&:error?)
    ["FixFlow settings need attention:", *lines, "", footer].compact.join("\n")
  end

  # Whether a setting is blank, or still one of the stand-in values from the examples.
  def self.placeholder?(text) = text.to_s.strip.match?(PLACEHOLDER)

  private

  def value(name) = @env[name].to_s.strip

  def present?(name) = !value(name).empty?

  def problem(level, setting, message) = Problem.new(level, setting, message)

  def secret(name, minimum, how)
    text = value(name)
    return problem(:error, name, "is not set. Make one with `#{how}` and put it in the environment.") if text.empty?
    return problem(:error, name, "is still the example value. Make one with `#{how}`.") if self.class.placeholder?(text)
    return if text.length >= minimum

    problem(:error, name, "is too short (#{text.length} characters; at least #{minimum} are needed). Make one with `#{how}`.")
  end

  def uri_for(name, schemes)
    uri = URI.parse(value(name))
    uri if schemes.include?(uri.scheme) && !uri.host.to_s.empty?
  rescue URI::InvalidURIError
    nil
  end

  def database_url
    unless present?("DATABASE_URL")
      return problem(:warning, "DATABASE_URL",
                     "is not set, so the server will try the PostgreSQL on this machine (database fixflow_production).")
    end

    uri = uri_for("DATABASE_URL", %w[postgres postgresql])
    unless uri && uri.path.to_s.length > 1
      return problem(:error, "DATABASE_URL", "is not a PostgreSQL address. It looks like postgres://user:password@host:5432/database.")
    end

    password_problem("DATABASE_URL", uri)
  end

  def redis_url
    return problem(:warning, "REDIS_URL", "is not set, so the server will use redis://localhost:6379/0.") unless present?("REDIS_URL")

    uri = uri_for("REDIS_URL", %w[redis rediss])
    return problem(:error, "REDIS_URL", "is not a Redis address. It looks like redis://:password@host:6379/0.") unless uri

    password_problem("REDIS_URL", uri)
  end

  def password_problem(setting, uri)
    return unless self.class.placeholder?(URI.decode_www_form_component(uri.password.to_s))

    problem(:error, setting, "has the example password in it. Choose a strong password, and set the same one on that service.")
  end

  def app_url
    unless present?("APP_URL")
      return if present?("APP_HOST")

      return problem(:warning, "APP_URL", "is not set, so links in emails (invitations, password resets) will point at " \
                                          "https://localhost. Set it to where people open FixFlow.")
    end

    uri = uri_for("APP_URL", %w[http https])
    unless uri && ["", "/"].include?(uri.path.to_s)
      return problem(:error, "APP_URL", "is not a web address. It looks like https://fixflow.example.com")
    end
    return unless uri.host.end_with?("fixflow.dev")

    problem(:warning, "APP_URL", "is the example address (#{uri.host}), so links in emails will not work.")
  end

  def allowed_origins
    return unless present?("ALLOWED_ORIGINS")

    origins = value("ALLOWED_ORIGINS").split(",").map(&:strip).reject(&:empty?)
    bad = origins.reject { |origin| origin_ok?(origin) }
    if bad.any?
      listed = bad.map { |origin| "\"#{origin}\"" }.join(", ")
      return problem(:error, "ALLOWED_ORIGINS",
                     "has #{listed}; each must look like https://host or http://host:port, no path, separated by commas.")
    end
    return if app_origin.nil? || origins.any? { |origin| origin.chomp("/") == app_origin }

    problem(:warning, "ALLOWED_ORIGINS", "does not include APP_URL (#{value('APP_URL')}), so a browser may refuse the web " \
                                         "app's requests unless the web app and the API share one address.")
  end

  def app_origin
    uri = uri_for("APP_URL", %w[http https])
    return unless uri

    port = uri.port == uri.default_port ? nil : ":#{uri.port}"
    "#{uri.scheme}://#{uri.host}#{port}"
  end

  def origin_ok?(origin)
    uri = URI.parse(origin)
    %w[http https].include?(uri.scheme) && !uri.host.to_s.empty? && ["", "/"].include?(uri.path.to_s)
  rescue URI::InvalidURIError
    false
  end

  def smtp_settings
    return unless present?("SMTP_HOST")
    return problem(:error, "SMTP_PORT", "must be a port number from 1 to 65535.") unless port_ok?("SMTP_PORT", 587)
    return unless self.class.placeholder?(value("SMTP_PASSWORD"))

    problem(:warning, "SMTP_PASSWORD", "is the example value, so email will not send until you put the real one here or " \
                                       "set up email under Settings, Email.")
  end

  def mqtt_settings
    return unless present?("MQTT_HOST")
    return problem(:error, "MQTT_PORT", "must be a port number from 1 to 65535.") unless port_ok?("MQTT_PORT", 1883)
    return unless self.class.placeholder?(value("MQTT_PASSWORD")) && present?("MQTT_PASSWORD")

    problem(:warning, "MQTT_PASSWORD", "is the example value; anyone who can reach the broker could send readings.")
  end

  def feature_settings
    found = []
    if value("SEED_DB") == "true"
      found << problem(:warning, "SEED_DB", "is true: demo accounts with a well-known password are loaded. " \
                                            "Use it only to try FixFlow out.")
    end
    if present?("IOT_RETENTION_DAYS") && !value("IOT_RETENTION_DAYS").match?(/\A\d+\z/)
      found << problem(:error, "IOT_RETENTION_DAYS", "must be a whole number of days.")
    end
    if present?("FIXFLOW_UPDATE_CHECK") && %w[true false].exclude?(value("FIXFLOW_UPDATE_CHECK").downcase)
      found << problem(:warning, "FIXFLOW_UPDATE_CHECK", "is \"#{value('FIXFLOW_UPDATE_CHECK')}\": only `false` turns the " \
                                                         "update check off, anything else leaves it on.")
    end
    key = value("ANTHROPIC_API_KEY")
    if value("AI_ENABLED") == "true" && (key.empty? || self.class.placeholder?(key))
      found << problem(:warning, "ANTHROPIC_API_KEY", "is missing or the example value, so the AI assistant will not work " \
                                                      "(set AI_ENABLED=false to hide it).")
    end
    found
  end

  def port_ok?(name, default)
    text = present?(name) ? value(name) : default.to_s
    text.match?(/\A\d+\z/) && (1..65_535).cover?(text.to_i)
  end
end
