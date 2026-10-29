namespace :fixflow do
  desc "Setup MinIO buckets (fixflow-uploads, fixflow-backups)"
  task minio_setup: :environment do
    require "aws-sdk-s3"
    client = Aws::S3::Client.new(
      endpoint:          ENV.fetch("MINIO_ENDPOINT", "http://minio:9000"),
      access_key_id:     ENV.fetch("MINIO_ACCESS_KEY"),
      secret_access_key: ENV.fetch("MINIO_SECRET_KEY"),
      region:            ENV.fetch("MINIO_REGION", "us-east-1"),
      force_path_style:  true
    )
    # Backups kept on another storage (BACKUP_S3_*) have their bucket there, made by whoever runs that storage.
    [ENV.fetch("MINIO_BUCKET", "fixflow-uploads"),
     *(ENV.fetch("MINIO_BACKUP_BUCKET", "fixflow-backups") unless BackupStore.separate?)].each do |bucket|
      client.create_bucket(bucket: bucket)
      puts "Created bucket: #{bucket}"
    rescue Aws::S3::Errors::BucketAlreadyOwnedByYou
      puts "Bucket already exists: #{bucket}"
    end
  end

  desc "Load a demo company with sample data (empty installs only; set CONFIRM=yes in production)"
  task demo_data: :environment do
    logins = Auditable.silenced { DemoDataService.load!(confirmed: ENV["CONFIRM"] == "yes") }
    puts "Demo data loaded. Sign in with any of these (password: #{DemoDataService::DEMO_PASSWORD}):"
    logins.each { |email| puts "  #{email}" }
  rescue DemoDataService::Refused => e
    abort e.message
  end

  desc "Generate API key for IoT device — usage: rails fixflow:create_api_key[org_id,name]"
  task :create_api_key, [:org_id, :name] => :environment do |_t, args|
    org = Organization.find(args[:org_id])
    ActsAsTenant.with_tenant(org) do
      raw_key, digest = ApiKey.generate
      ApiKey.create!(organization: org, name: args[:name], key_digest: digest)
      puts "API Key (shown ONCE — store it now):"
      puts raw_key
    end
  end

  desc "Run PM scheduler manually"
  task run_pm_scheduler: :environment do
    PmSchedulerJob.new.perform
    puts "PM scheduler completed."
  end

  desc "Remove sensor data and audit log lines older than the company's retention settings (the nightly jobs, by hand)"
  task cleanup_readings: :environment do
    Iot::CleanupReadingsJob.new.perform
    AuditLogCleanupJob.new.perform
    puts "Cleanup completed."
  end

  desc "Export all data for an organization — usage: rails fixflow:export_org[org_id,/tmp/export]"
  task :export_org, [:org_id, :output_dir] => :environment do |_t, args|
    output_dir = args[:output_dir] || Rails.root.join("tmp", "export_#{args[:org_id]}")
    FileUtils.mkdir_p(output_dir)
    org = Organization.find(args[:org_id])
    ActsAsTenant.with_tenant(org) do
      {
        assets:                  Asset.all,
        locations:               Location.all,
        work_orders:             WorkOrder.all,
        preventive_maintenances: PreventiveMaintenance.all,
        parts:                   Part.all,
        iot_rules:               IotRule.all,
        iot_alerts:              IotAlert.all,
        activity_logs:           ActivityLog.all
      }.each do |name, records|
        path = File.join(output_dir, "#{name}.json")
        File.write(path, records.to_json)
        puts "Exported #{records.count} #{name} → #{path}"
      end
    end
    puts "Export complete: #{output_dir}"
  end

  desc "Show system stats"
  task stats: :environment do
    require "sidekiq/api"
    stats = Sidekiq::Stats.new
    redis = Redis.new(url: ENV.fetch("REDIS_URL", "redis://localhost:6379/0"))

    ActsAsTenant.without_tenant do
      puts "\n── FixFlow System Stats ──────────────────"
      puts "Organizations : #{Organization.count}"
      puts "Users         : #{User.count}"
      puts "Assets        : #{Asset.unscoped.count}"
      puts "Work Orders   : #{WorkOrder.unscoped.count}"
      puts "IoT Alerts    : #{IotAlert.unscoped.count} (open: #{IotAlert.unscoped.where(status: 0).count})"
      puts ""
      puts "── Sidekiq ────────────────────────────────"
      puts "Enqueued      : #{stats.enqueued}"
      puts "Failed        : #{stats.failed}"
      puts "Processed     : #{stats.processed}"
      puts ""
      puts "── Redis ──────────────────────────────────"
      info = redis.info("memory")
      puts "Memory used   : #{info['used_memory_human']}"
    end
  end
end
