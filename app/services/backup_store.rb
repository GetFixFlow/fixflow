require "aws-sdk-s3"

# The storage bucket the nightly backups are kept in (the MinIO that ships with FixFlow, or any S3 storage).
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

  def self.bucket = ENV.fetch("MINIO_BACKUP_BUCKET", "fixflow-backups")
  def self.valid_name?(name) = name.to_s.match?(NAME)

  def initialize(client: nil)
    @client = client
  end

  delegate :bucket, to: :class

  # All backups, newest first.
  def list
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
    File.open(path, "rb") { |file| client.put_object(bucket: bucket, key: key(name), body: file) }
  end

  # The size of a backup in bytes; raises Missing when there is no such backup.
  def size(name)
    raise Missing, name unless self.class.valid_name?(name)

    client.head_object(bucket: bucket, key: key(name)).content_length
  rescue Aws::S3::Errors::NotFound, Aws::S3::Errors::NoSuchKey
    raise Missing, name
  end

  # Hands the backup to the block piece by piece, so a large one is never held in memory.
  def stream(name, &)
    raise Missing, name unless self.class.valid_name?(name)

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
    old.each { |backup| client.delete_object(bucket: bucket, key: key(backup.name)) }
    old.map(&:name)
  end

  private

  def key(name) = "#{PREFIX}#{name}"

  def client
    @client ||= Aws::S3::Client.new(
      endpoint:          ENV.fetch("MINIO_ENDPOINT", "http://minio:9000"),
      access_key_id:     ENV["MINIO_ACCESS_KEY"] || ENV.fetch("MINIO_ACCESS_KEY_ID"),
      secret_access_key: ENV["MINIO_SECRET_KEY"] || ENV.fetch("MINIO_SECRET_ACCESS_KEY"),
      region:            ENV.fetch("MINIO_REGION", "us-east-1"),
      force_path_style:  true,
      # A storage that does not answer should fail the page in seconds, not after the library's default minute.
      http_open_timeout: 5,
      retry_limit:       1
    )
  end
end
