require "aws-sdk-s3"

# The storage bucket the nightly backups are kept in. By default that is the file storage that ships with FixFlow
# (the MINIO_* settings), which is the same server and disk as the data: it does not survive losing them. Set
# BACKUP_S3_ACCESS_KEY and BACKUP_S3_SECRET_KEY (and BACKUP_S3_ENDPOINT, unless it is Amazon S3) to keep the backups
# on another S3 storage instead; then nothing falls back to the MINIO_* settings.
# With FILE_STORAGE=disk (the lite install, which has no storage server) and no BACKUP_S3_* settings, the backups are
# files in a folder instead (BACKUP_DIR): the same rules, the same names, on the server's own disk.
# A backup is a gzipped SQL dump named fixflow_YYYYMMDD_HHMMSS.sql.gz under backups/; anything else in the
# bucket is not a backup and is neither listed nor deleted.
class BackupStore
  PREFIX = "backups/".freeze
  NAME = /\Afixflow_\d{8}_\d{6}\.sql\.gz\z/

  Backup = Struct.new(:name, :bytes, :created_at, keyword_init: true)
  # Asked for a backup that is not in the bucket.
  class Missing < StandardError; end
  # What the storage does when it is down, wrongly set up or refuses us. Anything else is a bug and is not hidden.
  # (Here, not in a controller: this file loads the S3 library, which the Gemfile leaves to be required on use.)
  UNREACHABLE = [Aws::Errors::ServiceError, Seahorse::Client::NetworkingError, KeyError, SystemCallError, SocketError].freeze

  def self.separate? = ENV["BACKUP_S3_ACCESS_KEY"].present? || ENV["BACKUP_S3_ENDPOINT"].present?

  # The backups are files in a folder, not objects in a bucket.
  def self.disk? = ENV["FILE_STORAGE"] == "disk" && !separate?

  def self.directory = Pathname.new(ENV.fetch("BACKUP_DIR", Rails.root.join("backups").to_s))

  # Where the backups are, for people: the folder, or the bucket.
  def self.location = disk? ? directory.to_s : bucket

  # ... in a sentence ("Could not read #{place}").
  def self.place = disk? ? "the #{directory} folder" : "the #{bucket} bucket"

  def self.bucket
    separate? ? ENV.fetch("BACKUP_S3_BUCKET", "fixflow-backups") : ENV.fetch("MINIO_BACKUP_BUCKET", "fixflow-backups")
  end

  def self.build_client
    # A storage that does not answer should fail the page in seconds, not after the library's default minute.
    common = { http_open_timeout: 5, retry_limit: 1 }
    if separate?
      Aws::S3::Client.new(
        endpoint:          ENV["BACKUP_S3_ENDPOINT"].presence,
        access_key_id:     ENV.fetch("BACKUP_S3_ACCESS_KEY"),
        secret_access_key: ENV.fetch("BACKUP_S3_SECRET_KEY"),
        region:            ENV.fetch("BACKUP_S3_REGION", "us-east-1"),
        force_path_style:  ENV.fetch("BACKUP_S3_PATH_STYLE", "true") != "false",
        **common
      )
    else
      Aws::S3::Client.new(
        endpoint:          ENV.fetch("MINIO_ENDPOINT", "http://minio:9000"),
        access_key_id:     ENV["MINIO_ACCESS_KEY"] || ENV.fetch("MINIO_ACCESS_KEY_ID"),
        secret_access_key: ENV["MINIO_SECRET_KEY"] || ENV.fetch("MINIO_SECRET_ACCESS_KEY"),
        region:            ENV.fetch("MINIO_REGION", "us-east-1"),
        force_path_style:  true,
        **common
      )
    end
  end

  def self.valid_name?(name) = name.to_s.match?(NAME)

  def initialize(client: nil)
    @client = client
  end

  # The backup files of a folder install (see .disk?).
  def self.files_directory = directory.join("files")

  delegate :bucket, to: :class

  # All backups, newest first.
  def list
    return disk_list if self.class.disk?

    backups = []
    client.list_objects_v2(bucket: bucket, prefix: PREFIX).each do |page|
      page.contents.each do |object|
        name = object.key.delete_prefix(PREFIX)
        next unless self.class.valid_name?(name)

        backups << Backup.new(name: name, bytes: object.size, created_at: object.last_modified)
      end
    end
    backups.sort_by(&:created_at).reverse
  end

  def put(name, path)
    return disk_put(name, path) if self.class.disk?

    File.open(path, "rb") { |file| client.put_object(bucket: bucket, key: key(name), body: file) }
  end

  # The size of a backup in bytes; raises Missing when there is no such backup.
  def size(name)
    raise Missing, name unless self.class.valid_name?(name)
    return disk_size(name) if self.class.disk?

    client.head_object(bucket: bucket, key: key(name)).content_length
  rescue Aws::S3::Errors::NotFound, Aws::S3::Errors::NoSuchKey
    raise Missing, name
  end

  # Hands the backup to the block piece by piece, so a large one is never held in memory.
  def stream(name, &)
    raise Missing, name unless self.class.valid_name?(name)
    return disk_stream(name, &) if self.class.disk?

    client.get_object(bucket: bucket, key: key(name), &)
  rescue Aws::S3::Errors::NoSuchKey
    raise Missing, name
  end

  def fetch(name, path)
    File.open(path, "wb") { |file| stream(name) { |chunk| file.write(chunk) } }
  end

  # Deletes the backups made before the time; returns their names.
  def delete_older_than(time)
    old = list.select { |backup| backup.created_at < time }
    old.each { |backup| self.class.disk? ? File.delete(disk_path(backup.name)) : client.delete_object(bucket: bucket, key: key(backup.name)) }
    old.map(&:name)
  end

  private

  # --- a folder (the lite install) ---

  # The name has been checked against NAME, so it cannot name anything outside the folder.
  def disk_path(name) = self.class.directory.join(PREFIX, name)

  def disk_list
    Dir.glob(self.class.directory.join(PREFIX, "*")).filter_map do |path|
      name = File.basename(path)
      Backup.new(name: name, bytes: File.size(path), created_at: File.mtime(path).utc) if self.class.valid_name?(name)
    end.sort_by(&:created_at).reverse
  rescue Errno::ENOENT
    []
  end

  # Written under another name and renamed, so a listed backup is always a whole one.
  def disk_put(name, path)
    target = disk_path(name)
    FileUtils.mkdir_p(target.dirname)
    FileUtils.cp(path, "#{target}.part")
    File.rename("#{target}.part", target)
  end

  def disk_size(name)
    File.size(disk_path(name))
  rescue Errno::ENOENT
    raise Missing, name
  end

  def disk_stream(name)
    File.open(disk_path(name), "rb") { |file| yield file.read(64 * 1024) until file.eof? }
  rescue Errno::ENOENT
    raise Missing, name
  end

  def key(name) = "#{PREFIX}#{name}"

  def client = @client ||= self.class.build_client
end
