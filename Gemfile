source "https://rubygems.org"

gem "rails", "~> 8.1.2"
gem "pg", "~> 1.1"
gem "puma", ">= 5.0"

# Auth
gem "devise", "~> 4.9"
gem "devise-jwt", "~> 0.12"

# Tree structure for locations
gem "ancestry", "~> 4.0"

# Soft delete for assets
gem "discard", "~> 0.4"

# QR code generation
gem "rqrcode", "~> 2.2"

# Work order state machine
gem "aasm", "~> 5.5"

# Audit trail for work order state changes
gem "paper_trail", "~> 15.0"

# CORS
gem "rack-cors"

# Background jobs
gem "sidekiq", "~> 7.3"
gem "sidekiq-scheduler", "~> 5.0"
gem "redis", "~> 5.0"

# IoT / MQTT
gem "mqtt", "~> 0.6"

# File storage (ActiveStorage + MinIO/S3)
gem "image_processing", "~> 1.2"
gem "aws-sdk-s3", require: false

# Pagination
gem "pagy", "~> 9.0"

# API serialization
gem "blueprinter", "~> 1.1"

# JSON schema / validation
gem "jsonapi-serializer", "~> 2.2"

# Reduces boot times through caching; required in config/boot.rb
gem "bootsnap", require: false

# Windows tzinfo
gem "tzinfo-data", platforms: %i[ windows jruby ]

group :development, :test do
  gem "debug", platforms: %i[ mri windows ], require: "debug/prelude"
  gem "brakeman", require: false
  gem "rubocop-rails", require: false
  gem "rubocop-rspec", require: false
end

group :test do
  gem "rspec-rails", "~> 7.0"
  gem "factory_bot_rails", "~> 6.4"
  gem "faker", "~> 3.4"
  gem "shoulda-matchers", "~> 6.4"
  gem "database_cleaner-active_record", "~> 2.2"
end
