# Stops a production server (or Sidekiq) that has no usable secrets or settings from starting, with a plain message
# instead of the "key not found" a later initializer would raise. The Docker entrypoint has already run the full check
# (`rails fixflow:check_config`) and says so; building the image, migrating or opening a console do not need it.
# SKIP_CONFIG_CHECK=true turns it off, for an emergency.
if Rails.env.production? && ENV["SECRET_KEY_BASE_DUMMY"].blank? && ENV["FIXFLOW_CONFIG_CHECKED"] != "true" &&
   ENV["SKIP_CONFIG_CHECK"] != "true" && (defined?(Rails::Server) || defined?(Sidekiq::CLI))
  require Rails.root.join("lib/fixflow_config_check")

  check = FixflowConfigCheck.new
  report = FixflowConfigCheck.report(check.problems)
  warn report unless report.empty?
  abort if check.errors.any? # rubocop:disable Rails/Exit -- stopping the start is the point
end
