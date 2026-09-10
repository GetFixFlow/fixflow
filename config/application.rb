require_relative "boot"

require "rails"
# Pick the frameworks you want:
require "active_model/railtie"
require "active_job/railtie"
require "active_record/railtie"
require "active_storage/engine"
require "action_controller/railtie"
require "action_mailer/railtie"
require "action_mailbox/engine"
require "action_text/engine"
require "action_view/railtie"
require "action_cable/engine"
# require "rails/test_unit/railtie"

# Require the gems listed in Gemfile, including any gems
# you've limited to :test, :development, or :production.
Bundler.require(*Rails.groups)

module Fixflow
  class Application < Rails::Application
    config.load_defaults 8.1
    config.autoload_lib(ignore: %w[assets tasks])
    config.api_only = true

    config.time_zone = "UTC"

    config.active_job.queue_adapter = :sidekiq

    # Devise's Warden hooks (sign_in/sign_out) write to the session even though
    # this is a JWT-authenticated API — api_only strips session middleware by
    # default, so add back the minimal pieces Devise needs.
    config.session_store :cookie_store, key: "_fixflow_session"
    config.middleware.use ActionDispatch::Cookies
    config.middleware.use config.session_store, config.session_options

    # Rack::Attack middleware for rate limiting
    config.middleware.use Rack::Attack
  end
end
