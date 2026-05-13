require "active_support/core_ext/integer/time"

Rails.application.configure do
  config.enable_reloading = false
  config.eager_load = true
  config.consider_all_requests_local = false
  config.public_file_server.headers = { "cache-control" => "public, max-age=#{1.year.to_i}" }

  # Active Storage: MinIO (S3-compatible)
  config.active_storage.service = :amazon

  # SSL
  config.assume_ssl  = true
  config.force_ssl   = true

  # Logging
  config.log_tags = [:request_id]
  config.logger   = ActiveSupport::TaggedLogging.logger(STDOUT)
  config.log_level = ENV.fetch("RAILS_LOG_LEVEL", "info")
  config.silence_healthcheck_path = "/up"
  config.active_support.report_deprecations = false

  # Lograge — structured JSON logs
  config.lograge.enabled   = true
  config.lograge.formatter = Lograge::Formatters::Json.new
  config.lograge.custom_options = lambda do |event|
    {
      request_id:      event.payload[:request_id],
      user_id:         event.payload[:user_id],
      organization_id: event.payload[:organization_id],
      duration_ms:     event.duration.round(2)
    }.compact
  end
  config.lograge.ignore_actions = ["Api::V1::HealthController#show"]

  # Redis cache store
  config.cache_store = :redis_cache_store, {
    url:                ENV.fetch("REDIS_URL", "redis://localhost:6379/1"),
    connect_timeout:    5,
    read_timeout:       1,
    write_timeout:      1,
    reconnect_attempts: 1,
    error_handler: ->(method:, returning:, exception:) {
      Rails.logger.error("[Cache] Redis error on #{method}: #{exception.message}")
    }
  }

  # Action Cable: Redis adapter
  config.action_cable.cable = { adapter: "redis", url: ENV.fetch("REDIS_URL", "redis://localhost:6379/0") }

  # Action Mailer
  config.action_mailer.raise_delivery_errors = false
  config.action_mailer.default_url_options = { host: ENV.fetch("APP_HOST", "localhost") }
  config.action_mailer.delivery_method = :smtp
  config.action_mailer.smtp_settings = {
    address:              ENV.fetch("SMTP_HOST", "smtp.sendgrid.net"),
    port:                 ENV.fetch("SMTP_PORT", 587).to_i,
    user_name:            ENV["SMTP_USERNAME"],
    password:             ENV["SMTP_PASSWORD"],
    authentication:       :plain,
    enable_starttls_auto: true
  }

  config.i18n.fallbacks = true
  config.active_record.dump_schema_after_migration = false
  config.active_record.attributes_for_inspect = [:id]
end
