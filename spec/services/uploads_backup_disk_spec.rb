require "rails_helper"
require "tmpdir"

# The lite install: the uploaded files are a folder (FILE_STORAGE=disk) and the copy of them is a folder, or, when another
# S3 storage is set for the backups, objects there.
RSpec.describe UploadsBackup, "with the files in a folder" do
  let(:root)     { Dir.mktmpdir("fixflow_uploads_backup") }
  let(:uploads)  { Pathname.new(root).join("uploads") }
  let(:backups)  { Pathname.new(root).join("backups") }
  let(:service)  { described_class.new }

  def with_env(values)
    stub_const("ENV", ENV.to_h.except("BACKUP_S3_ACCESS_KEY", "BACKUP_S3_SECRET_KEY", "BACKUP_S3_ENDPOINT").merge(values))
  end

  def write(base, name, content)
    path = base.join(name)
    FileUtils.mkdir_p(path.dirname)
    File.write(path, content)
  end

  before do
    with_env("FILE_STORAGE" => "disk", "BACKUP_DIR" => backups.to_s)
    allow(described_class).to receive(:uploads_directory).and_return(uploads)
    FileUtils.mkdir_p(uploads)
  end

  after { FileUtils.remove_entry(root) }

  context "when the copy is a folder too" do
    it "copies each file the copy lacks, keeping the folders Active Storage puts them in" do
      write(uploads, "ab/cd/abcdef", "one")
      write(uploads, "12/34/123456", "twenty")

      result = service.backup

      expect(result).to have_attributes(copied: 2, bytes: 9, present: 0)
      expect(backups.join("files/ab/cd/abcdef").read).to eq("one")
      expect(backups.join("files/12/34/123456").read).to eq("twenty")
    end

    it "copies nothing on a night when nothing is new, and a file whose size differs again" do
      write(uploads, "ab/cd/abcdef", "one")
      write(uploads, "12/34/123456", "twenty")
      service.backup
      write(uploads, "12/34/123456", "twenty-one") # a file is never changed in real life; a different size is a different file

      result = described_class.new.backup

      expect(result).to have_attributes(copied: 1, present: 1)
      expect(backups.join("files/12/34/123456").read).to eq("twenty-one")
    end

    it "never deletes from the copy a file that was deleted from the uploads" do
      write(uploads, "ab/cd/abcdef", "one")
      service.backup
      FileUtils.rm_rf(uploads)
      FileUtils.mkdir_p(uploads)

      described_class.new.backup

      expect(backups.join("files/ab/cd/abcdef")).to exist
    end

    it "restores what the uploads folder lacks, and leaves the files it has" do
      write(backups, "files/ab/cd/abcdef", "one")
      write(backups, "files/12/34/123456", "twenty")
      write(uploads, "12/34/123456", "twenty")

      result = service.restore

      expect(result).to have_attributes(copied: 1, bytes: 3, present: 1)
      expect(uploads.join("ab/cd/abcdef").read).to eq("one")
    end

    it "restores into an uploads folder that does not exist yet (a new server)" do
      write(backups, "files/ab/cd/abcdef", "one")
      FileUtils.rm_rf(uploads)

      expect(service.restore.copied).to eq(1)
      expect(uploads.join("ab/cd/abcdef").read).to eq("one")
    end

    it "does not need the S3 settings, which the lite install does not have" do
      write(uploads, "ab/cd/abcdef", "one")
      with_env("FILE_STORAGE" => "disk", "BACKUP_DIR" => backups.to_s) # no MINIO_* anywhere

      expect { described_class.new.backup }.not_to raise_error
    end
  end

  context "when the copy is on another S3 storage" do
    let(:client) { Aws::S3::Client.new(stub_responses: true) }
    let(:service) { described_class.new(backups: client, same_server: false) }

    before do
      with_env("FILE_STORAGE" => "disk", "BACKUP_S3_ACCESS_KEY" => "k", "BACKUP_S3_SECRET_KEY" => "s",
               "BACKUP_S3_ENDPOINT" => "https://s3.example.com", "BACKUP_S3_BUCKET" => "offsite")
    end

    it "sends each file the other storage lacks, as files/<its folder path>" do
      write(uploads, "ab/cd/abcdef", "one")
      write(uploads, "12/34/123456", "twenty")
      client.stub_responses(:list_objects_v2, contents: [{ key: "files/12/34/123456", size: 6, last_modified: Time.now }])
      sent = []
      allow(client).to receive(:put_object) { |args| sent << [args[:bucket], args[:key], args[:body].read] }

      result = service.backup

      expect(sent).to eq([["offsite", "files/ab/cd/abcdef", "one"]])
      expect(result).to have_attributes(copied: 1, present: 1)
    end

    it "brings back the files the uploads folder lacks" do
      client.stub_responses(:list_objects_v2, contents: [{ key: "files/ab/cd/abcdef", size: 3, last_modified: Time.now }])
      allow(client).to receive(:get_object) { |args| File.write(args[:response_target], "one") }

      expect(service.restore.copied).to eq(1)
      expect(uploads.join("ab/cd/abcdef").read).to eq("one")
    end
  end
end
