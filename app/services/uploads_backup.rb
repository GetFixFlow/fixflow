require "aws-sdk-s3"
require "tempfile"

# Keeps a copy of the uploaded photos and documents next to the database backups: every file in the uploads bucket
# is copied to files/ in the backup bucket, and `restore` copies back whatever the uploads bucket is missing.
#
# A file is copied when the backup has no file of that name, or one of another size. Uploaded files are never
# changed (their names are random), so that is enough, and a night with nothing new copies nothing. Files that were
# deleted from FixFlow stay in the copy: a database backup from last week may still point at them. Delete them from
# the backup bucket by hand if the space matters.
#
# With FILE_STORAGE=disk (the lite install) the uploads are a folder, and the copy is a folder (files/ in BACKUP_DIR) or,
# when BACKUP_S3_* is set, objects in that other storage: the same rules, on files instead of objects.
class UploadsBackup
  PREFIX = "files/".freeze

  Result = Struct.new(:copied, :bytes, :present, keyword_init: true)

  def self.bucket = ENV.fetch("MINIO_BUCKET", "fixflow-uploads")

  # The uploads client is built from the MINIO_* settings, like Active Storage's own.
  def self.uploads_client
    Aws::S3::Client.new(
      endpoint:          ENV.fetch("MINIO_ENDPOINT", "http://minio:9000"),
      access_key_id:     ENV["MINIO_ACCESS_KEY"] || ENV.fetch("MINIO_ACCESS_KEY_ID"),
      secret_access_key: ENV["MINIO_SECRET_KEY"] || ENV.fetch("MINIO_SECRET_ACCESS_KEY"),
      region:            ENV.fetch("MINIO_REGION", "us-east-1"),
      force_path_style:  true,
      http_open_timeout: 5,
      retry_limit:       1
    )
  end

  # uploads: the client for the uploads bucket; backups: the client for the backup bucket. When both are the same
  # storage server a file is copied inside it; otherwise it goes through a temporary file on this server.
  def initialize(uploads: nil, backups: nil, same_server: !BackupStore.separate?)
    @uploads = uploads
    @backups = backups
    @same_server = same_server
  end

  def self.disk? = ENV["FILE_STORAGE"] == "disk"

  # The folder the uploaded files are in, when they are in one.
  def self.uploads_directory = Pathname.new(ActiveStorage::Blob.service.root)

  # Uploads bucket -> backup bucket.
  def backup
    return copy_files(from: self.class.uploads_directory, to: :backups) if self.class.disk?

    copy(from: uploads, from_bucket: self.class.bucket, from_prefix: "",
         to: backups, to_bucket: BackupStore.bucket, to_prefix: PREFIX)
  end

  # Backup bucket -> uploads bucket, for a new server or a lost disk. Creates the uploads bucket if it is not there.
  def restore
    return copy_files(from: :backups, to: self.class.uploads_directory) if self.class.disk?

    ensure_bucket(uploads, self.class.bucket)
    copy(from: backups, from_bucket: BackupStore.bucket, from_prefix: PREFIX,
         to: uploads, to_bucket: self.class.bucket, to_prefix: "")
  end

  private

  def uploads = @uploads ||= self.class.uploads_client
  def backups = @backups ||= BackupStore.build_client

  # The folder install. A side is the uploads folder (a Pathname) or :backups, which is a folder (BACKUP_DIR/files) or
  # the other S3 storage (BACKUP_S3_*, under files/).
  def copy_files(from:, to:)
    result = Result.new(copied: 0, bytes: 0, present: 0)
    FileUtils.mkdir_p(to) if to.is_a?(Pathname)
    have = to == :backups ? backup_sizes : tree_sizes(to)
    source = from == :backups ? backup_sizes : tree_sizes(from)
    source.each do |name, size|
      if have[name] == size
        result.present += 1
        next
      end

      put_file(to, name) { |path| fetch_file(from, name, path) }
      result.copied += 1
      result.bytes += size
    end
    result
  end

  # { relative path => size } of every file under the folder.
  def tree_sizes(root)
    root = Pathname.new(root)
    Dir.glob(root.join("**", "*"), File::FNM_DOTMATCH).select { |path| File.file?(path) }
       .to_h { |path| [Pathname.new(path).relative_path_from(root).to_s, File.size(path)] }
  end

  def backup_sizes
    return tree_sizes(BackupStore.files_directory) if BackupStore.disk?

    sizes(backups, BackupStore.bucket, PREFIX)
  end

  # Gives the block a path to write the file to, then puts it in the place named (a folder, or :backups).
  def put_file(place, name)
    Tempfile.create("fixflow_file", binmode: true) do |file|
      yield file.path
      if place == :backups && !BackupStore.disk?
        file.rewind
        backups.put_object(bucket: BackupStore.bucket, key: PREFIX + name, body: file)
      else
        target = (place == :backups ? BackupStore.files_directory : place).join(name)
        FileUtils.mkdir_p(target.dirname)
        FileUtils.cp(file.path, "#{target}.part")
        File.rename("#{target}.part", target)
      end
    end
  end

  def fetch_file(place, name, path)
    if place == :backups && !BackupStore.disk?
      backups.get_object(bucket: BackupStore.bucket, key: PREFIX + name, response_target: path)
    else
      FileUtils.cp((place == :backups ? BackupStore.files_directory : place).join(name), path)
    end
  end

  def copy(from:, from_bucket:, from_prefix:, to:, to_bucket:, to_prefix:)
    have = sizes(to, to_bucket, to_prefix)
    result = Result.new(copied: 0, bytes: 0, present: 0)
    each_object(from, from_bucket, from_prefix) do |name, size|
      if have[name] == size
        result.present += 1
        next
      end

      copy_one(from, from_bucket, from_prefix + name, to, to_bucket, to_prefix + name)
      result.copied += 1
      result.bytes += size
    end
    result
  end

  def copy_one(from, from_bucket, from_key, to, to_bucket, to_key)
    if @same_server
      source = "#{from_bucket}/#{from_key.split('/').map { |part| ERB::Util.url_encode(part) }.join('/')}"
      to.copy_object(bucket: to_bucket, key: to_key, copy_source: source)
    else
      Tempfile.create("fixflow_file", binmode: true) do |file|
        from.get_object(bucket: from_bucket, key: from_key, response_target: file.path)
        file.rewind
        to.put_object(bucket: to_bucket, key: to_key, body: file)
      end
    end
  end

  # { name => size } of everything under the prefix.
  def sizes(client, bucket, prefix)
    each_object(client, bucket, prefix).to_h
  end

  # name (without the prefix) and size of every object under the prefix; an enumerator without a block.
  def each_object(client, bucket, prefix)
    return enum_for(:each_object, client, bucket, prefix) unless block_given?

    client.list_objects_v2(bucket: bucket, prefix: prefix).each do |page|
      page.contents.each do |object|
        name = object.key.delete_prefix(prefix)
        yield name, object.size unless name.empty? || name.end_with?("/")
      end
    end
  end

  def ensure_bucket(client, bucket)
    client.head_bucket(bucket: bucket)
  rescue Aws::S3::Errors::NotFound, Aws::S3::Errors::NoSuchBucket
    client.create_bucket(bucket: bucket)
  end
end
