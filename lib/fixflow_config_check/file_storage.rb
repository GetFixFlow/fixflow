class FixflowConfigCheck
  # The settings for the file storage (MINIO_*, used for uploaded photos and documents) and for backups kept on
  # another S3 storage (BACKUP_S3_*).
  module FileStorage
    private

    # FILE_STORAGE=disk (the lite install) keeps uploads, and backups unless BACKUP_S3_* is set, in folders on the disk.
    def minio_settings
      return disk_storage_settings if present?("FILE_STORAGE") && value("FILE_STORAGE") != "s3"

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

    def disk_storage_settings
      unless value("FILE_STORAGE") == "disk"
        return problem(:error, "FILE_STORAGE", "is \"#{value('FILE_STORAGE')}\": use disk (files in folders on this server, the lite install) " \
                                               "or leave it out (files in an S3-compatible storage).")
      end

      found = backup_storage_settings
      if present?("MINIO_ENDPOINT") || present?("MINIO_ACCESS_KEY") || present?("MINIO_SECRET_KEY")
        found << problem(:warning, "FILE_STORAGE", "is disk, so the MINIO_* settings are not used: uploaded files go to " \
                                                    "#{value('STORAGE_DIR').empty? ? 'the storage folder' : value('STORAGE_DIR')}.")
      end
      found
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
