require "rails_helper"

RSpec.describe UploadsBackup do
  let(:uploads) { Aws::S3::Client.new(stub_responses: true) }
  let(:backups) { Aws::S3::Client.new(stub_responses: true) }
  let(:now)     { Time.utc(2026, 10, 29, 3, 0, 0) }

  def object(key, size) = { key: key, size: size, last_modified: now }

  def listing(client, *objects) = client.stub_responses(:list_objects_v2, contents: objects)

  context "when the backups are on the same storage server" do
    subject(:service) { described_class.new(uploads: uploads, backups: backups, same_server: true) }

    let(:client) { uploads }

    before do
      allow(BackupStore).to receive(:bucket).and_return("fixflow-backups")
      allow(described_class).to receive(:bucket).and_return("fixflow-uploads")
    end

    it "copies each file the backup lacks, inside the storage, and leaves the ones it has" do
      listing(uploads, object("abc123", 10), object("def456", 20), object("ghi789", 30))
      listing(backups, object("files/abc123", 10), object("files/def456", 999))
      copied = []
      allow(backups).to receive(:copy_object) { |args| copied << args }

      result = service.backup

      expect(copied.map { |args| args.values_at(:bucket, :key, :copy_source) }).to eq([
        ["fixflow-backups", "files/def456", "fixflow-uploads/def456"],
        ["fixflow-backups", "files/ghi789", "fixflow-uploads/ghi789"]
      ])
      expect(result.to_h).to eq(copied: 2, bytes: 50, present: 1)
    end

    it "looks in the uploads bucket, and only under files/ in the backup bucket" do
      expect(uploads).to receive(:list_objects_v2).with(bucket: "fixflow-uploads", prefix: "").and_call_original
      expect(backups).to receive(:list_objects_v2).with(bucket: "fixflow-backups", prefix: "files/").and_call_original

      service.backup
    end

    it "encodes a name that needs it, and ignores folder placeholders" do
      listing(uploads, object("variants/a b/c", 5), object("variants/", 0))
      listing(backups)
      expect(backups).to receive(:copy_object).once.with(hash_including(copy_source: "fixflow-uploads/variants/a%20b/c"))

      expect(service.backup.copied).to eq(1)
    end

    it "copies nothing on a night with nothing new" do
      listing(uploads, object("abc123", 10))
      listing(backups, object("files/abc123", 10))
      expect(backups).not_to receive(:copy_object)

      expect(service.backup.to_h).to eq(copied: 0, bytes: 0, present: 1)
    end

    it "reads every page of a long listing" do
      uploads.stub_responses(:list_objects_v2, [
        { contents: [object("a", 1)], is_truncated: true, next_continuation_token: "t" },
        { contents: [object("b", 2)], is_truncated: false }
      ])
      listing(backups)
      allow(backups).to receive(:copy_object)

      expect(service.backup.copied).to eq(2)
    end

    it "never deletes anything, even a file that is no longer uploaded" do
      listing(uploads)
      listing(backups, object("files/gone", 10))
      expect(backups).not_to receive(:delete_object)
      expect(backups).not_to receive(:delete_objects)

      expect(service.backup.to_h).to eq(copied: 0, bytes: 0, present: 0)
    end

    it "restores the files the uploads bucket lacks from files/, after making sure the bucket exists" do
      listing(backups, object("files/abc123", 10), object("files/def456", 20))
      listing(uploads, object("abc123", 10))
      uploads.stub_responses(:head_bucket, "NotFound")
      expect(uploads).to receive(:create_bucket).with(bucket: "fixflow-uploads")
      copied = []
      allow(uploads).to receive(:copy_object) { |args| copied << args }

      result = service.restore

      expect(copied.map { |args| args.values_at(:bucket, :key, :copy_source) })
        .to eq([["fixflow-uploads", "def456", "fixflow-backups/files/def456"]])
      expect(result.to_h).to eq(copied: 1, bytes: 20, present: 1)
    end
  end

  context "when the backups are on another storage" do
    subject(:service) { described_class.new(uploads: uploads, backups: backups, same_server: false) }

    before do
      allow(BackupStore).to receive(:bucket).and_return("offsite")
      allow(described_class).to receive(:bucket).and_return("fixflow-uploads")
    end

    it "carries the file over through a temporary file that does not outlive the copy" do
      listing(uploads, object("abc123", 11))
      listing(backups)
      allow(uploads).to receive(:get_object) { |args| File.write(args[:response_target], "file content") }
      sent = nil
      path = nil
      allow(backups).to receive(:put_object) do |args|
        path = args[:body].path
        sent = [args[:bucket], args[:key], args[:body].read]
      end

      expect(service.backup.copied).to eq(1)
      expect(sent).to eq(["offsite", "files/abc123", "file content"])
      expect(File.exist?(path)).to be(false)
    end

    it "does not use the storage's own copy call, which would need both buckets on one server" do
      listing(uploads, object("abc123", 3))
      listing(backups)
      allow(uploads).to receive(:get_object) { |args| File.write(args[:response_target], "abc") }
      allow(backups).to receive(:put_object)
      expect(backups).not_to receive(:copy_object)
      expect(uploads).not_to receive(:copy_object)

      service.backup
    end
  end
end
