class DatabaseBackupJob < ApplicationJob
  queue_as :scheduled

  RETENTION_DAYS = 30

  def perform
    return unless Rails.env.production?

    started_at  = Time.current
    filename    = "fixflow_#{started_at.strftime('%Y%m%d_%H%M%S')}.sql.gz"
    local_path  = Rails.root.join("tmp", filename)
    bucket      = ENV.fetch("MINIO_BACKUP_BUCKET", "fixflow-backups")

    run_dump(local_path)
    upload_to_storage(local_path, filename, bucket)
    cleanup_old_backups(bucket)

    duration = (Time.current - started_at).round(1)
    size_mb   = (File.size(local_path).to_f / 1.megabyte).round(2)
    Rails.logger.info("[Backup] Completed in #{duration}s — #{size_mb} MB — #{filename}")
  rescue StandardError => e
    Rails.logger.error("[Backup] Failed: #{e.class} — #{e.message}")
    AdminMailer.backup_failed(e.message).deliver_later if defined?(AdminMailer)
    raise
  ensure
    File.delete(local_path) if local_path && File.exist?(local_path)
  end

  private

  def run_dump(local_path)
    db_url = ENV.fetch("DATABASE_URL")
    uri    = URI.parse(db_url)

    env = {
      "PGPASSWORD" => uri.password.to_s,
      "PGHOST"     => uri.host,
      "PGPORT"     => (uri.port || 5432).to_s,
      "PGUSER"     => uri.user
    }
    db_name = uri.path.delete_prefix("/")

    success = system(env, "pg_dump #{db_name} | gzip > #{local_path}", exception: false)
    raise "pg_dump failed" unless success
  end

  def upload_to_storage(local_path, filename, bucket)
    client = Aws::S3::Client.new(
      endpoint:             ENV.fetch("MINIO_ENDPOINT", "http://minio:9000"),
      access_key_id:        ENV.fetch("MINIO_ACCESS_KEY"),
      secret_access_key:    ENV.fetch("MINIO_SECRET_KEY"),
      region:               ENV.fetch("MINIO_REGION", "us-east-1"),
      force_path_style:     true
    )
    File.open(local_path, "rb") do |f|
      client.put_object(bucket: bucket, key: "backups/#{filename}", body: f)
    end
  end

  def cleanup_old_backups(bucket)
    client = Aws::S3::Client.new(
      endpoint:          ENV.fetch("MINIO_ENDPOINT", "http://minio:9000"),
      access_key_id:     ENV.fetch("MINIO_ACCESS_KEY"),
      secret_access_key: ENV.fetch("MINIO_SECRET_KEY"),
      region:            ENV.fetch("MINIO_REGION", "us-east-1"),
      force_path_style:  true
    )
    cutoff = RETENTION_DAYS.days.ago
    client.list_objects_v2(bucket: bucket, prefix: "backups/").contents
          .select { |obj| obj.last_modified < cutoff }
          .each   { |obj| client.delete_object(bucket: bucket, key: obj.key) }
  end
end
