class FixflowConfigCheck
  # The settings for the file storage (MINIO_*, used for uploaded photos and documents) and for backups kept on
  # another S3 storage (BACKUP_S3_*).
  module FileStorage
    private

    def minio_settings
      found = []
      if present?("MINIO_ENDPOINT") && !uri_for("MINIO_ENDPOINT", %w[http https])
        found << problem(:error, "MINIO_ENDPOINT", "is not a web address. It looks like http://minio:9000")
      end
      secret = present?("MINIO_SECRET_ACCESS_KEY") ? value("MINIO_SECRET_ACCESS_KEY") : value("MINIO_SECRET_KEY")
      if self.class.placeholder?(secret) && !secret.empty?
        found << problem(:warning, "MINIO_SECRET_KEY", "is the example value; anyone who can reach the file storage could read uploads")
      end
      found.concat(backup_storage_settings)
    end

    # Once the key or the endpoint is set, both logins are needed, because nothing falls back to the MINIO_* ones
    # (they would be sent to the wrong server).
    def backup_storage_settings
      return [] unless present?("BACKUP_S3_ACCESS_KEY") || present?("BACKUP_S3_ENDPOINT")

      found = %w[BACKUP_S3_ACCESS_KEY BACKUP_S3_SECRET_KEY].reject { |name| present?(name) }.map do |name|
        problem(:error, name, "is needed as well: backups kept on another storage (BACKUP_S3_*) do not use the MINIO_* login.")
      end
      if present?("BACKUP_S3_ENDPOINT") && !uri_for("BACKUP_S3_ENDPOINT", %w[http https])
        found << problem(:error, "BACKUP_S3_ENDPOINT", "is not a web address. It looks like https://s3.example.com")
      end
      found
    end
  end
end
