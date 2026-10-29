namespace :fixflow do
  desc "Back up now, as the nightly job does: the database dump and a copy of the uploaded files"
  task backup: :environment do
    name = DatabaseBackupJob.new.backup
    puts "Backed up as #{name} in the #{BackupStore.bucket} bucket."
  rescue StandardError => e
    abort "Not backed up: #{e.class}: #{e.message}"
  end

  desc "List the database backups in the file storage, newest first"
  task backups: :environment do
    backups = BackupStore.new.list
    puts "No backups in the #{BackupStore.bucket} bucket." if backups.empty?
    backups.each do |backup|
      puts format("%<name>-34s %<size>10s  %<at>s", name: backup.name, size: ActiveSupport::NumberHelper.number_to_human_size(backup.bytes),
                                                    at: backup.created_at.utc.strftime("%Y-%m-%d %H:%M UTC"))
    end
  rescue StandardError => e
    abort "Could not read the #{BackupStore.bucket} bucket: #{e.class}: #{e.message}"
  end

  desc "Restore a backup into an empty database. Usage: rails \"fixflow:restore[latest]\", " \
       "rails \"fixflow:restore[fixflow_20261018_030000.sql.gz]\" or rails \"fixflow:restore[/path/to/dump.sql.gz]\". " \
       "REPLACE=yes first deletes everything in the database. FILES=no leaves the uploaded files alone. " \
       "Stop the web and worker processes first."
  task :restore, [:source] => :environment do |_task, args|
    source = args[:source].to_s
    abort "Say which backup to restore: a file name from fixflow:backups, a path, or latest." if source.empty?

    downloaded = nil
    begin
      path =
        if File.file?(source)
          source
        else
          name = source == "latest" ? BackupStore.new.list.first&.name : source
          abort "There is no backup to restore." if name.nil?
          abort "#{source} is neither a file nor a backup name (fixflow_YYYYMMDD_HHMMSS.sql.gz)." unless BackupStore.valid_name?(name)

          downloaded = Tempfile.new(["fixflow_restore", ".sql.gz"])
          puts "Fetching #{name} from the #{BackupStore.bucket} bucket..."
          BackupStore.new.fetch(name, downloaded.path)
          downloaded.path
        end

      puts "Restoring #{source == 'latest' ? 'the newest backup' : source} into #{ActiveRecord::Base.connection_db_config.database}..."
      tables = DatabaseRestore.new(path, replace: ENV["REPLACE"] == "yes").call
      puts "Restored #{tables} tables."

      puts DatabaseRestore.migration_advice(*DatabaseRestore.migration_status)
    rescue StandardError => e
      abort "Not restored: #{e.message}"
    ensure
      downloaded&.close!
    end

    next if ENV["FILES"] == "no"

    Rake::Task["fixflow:restore_files"].reenable
    Rake::Task["fixflow:restore_files"].invoke
  end

  desc "Copy the uploaded photos and documents from the backup storage back to the file storage (what it lacks)"
  task restore_files: :environment do
    puts "Restoring the uploaded files from the #{BackupStore.bucket} bucket..."
    files = UploadsBackup.new.restore
    puts "Restored #{files.copied} uploaded files (#{ActiveSupport::NumberHelper.number_to_human_size(files.bytes)}); " \
         "#{files.present} were already there."
  rescue StandardError => e
    abort "The uploaded files were not restored: #{e.class}: #{e.message.delete_suffix('.')}. " \
          "Run rails fixflow:restore_files again when the #{BackupStore.bucket} bucket answers."
  end
end
