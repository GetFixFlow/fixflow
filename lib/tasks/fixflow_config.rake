namespace :fixflow do
  desc "Check the server's settings and that the database, Redis and mail server answer; exits 1 on an error " \
       "(fixflow:check_config[static] skips the network checks)"
  # Deliberately without :environment: the settings it checks are the ones that stop the application from loading.
  task :check_config, [:mode] do |_task, args| # rubocop:disable Rails/RakeEnvironment
    require_relative "../fixflow_config_check"

    check = FixflowConfigCheck.new
    report = FixflowConfigCheck.report(check.problems)
    puts report unless report.empty?
    exit(1) if check.errors.any?

    next if args[:mode] == "static"

    Rake::Task["fixflow:check_live"].invoke
    puts "FixFlow settings look right." if check.problems.empty?
  end

  # Needs the application loaded (so the database settings are the ones the server will use).
  task check_live: :environment do
    live = FixflowConfigCheck::Live.new(
      database: -> { ActiveRecord::Base.connection.execute("SELECT 1") },
      redis: -> { Redis.new(url: ENV.fetch("REDIS_URL", "redis://localhost:6379/0"), connect_timeout: 3).ping }
    )
    problems = live.problems
    report = FixflowConfigCheck.report(problems)
    puts report unless report.empty?
    exit(1) if problems.any?(&:error?)
  end
end
