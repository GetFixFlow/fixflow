ActsAsTenant.configure do |config|
  config.require_tenant = false  # Don't raise when tenant not set (e.g. rake tasks, seeds)
end
