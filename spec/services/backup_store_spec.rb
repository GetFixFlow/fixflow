require "rails_helper"

RSpec.describe BackupStore do
  let(:client) { Aws::S3::Client.new(stub_responses: true) }
  let(:store)  { described_class.new(client: client) }
  let(:now)    { Time.utc(2026, 10, 18, 3, 0, 0) }

  def object(key, at, size: 10) = { key: key, last_modified: at, size: size }

  describe "where the backups are kept" do
    let(:ours) { { "BACKUP_S3_ACCESS_KEY" => "k", "BACKUP_S3_SECRET_KEY" => "s", "BACKUP_S3_ENDPOINT" => "https://s3.example.com" } }

    def with_env(values)
      stub_const("ENV", ENV.to_h.except(*ours.keys, "BACKUP_S3_BUCKET", "BACKUP_S3_REGION").merge(values))
    end

    it "is the file storage's backup bucket unless another storage is set" do
      with_env("MINIO_BACKUP_BUCKET" => "mine")

      expect(described_class.separate?).to be(false)
      expect(described_class.bucket).to eq("mine")
    end

    it "is another storage, and its own bucket, once BACKUP_S3_* is set" do
      with_env(ours.merge("MINIO_BACKUP_BUCKET" => "mine", "BACKUP_S3_BUCKET" => "offsite"))

      expect(described_class.separate?).to be(true)
      expect(described_class.bucket).to eq("offsite")
    end

    it "talks to the other storage with its own login, never the file storage's" do
      with_env(ours.merge("MINIO_ENDPOINT" => "http://s3:8333", "MINIO_ACCESS_KEY" => "minio", "MINIO_SECRET_KEY" => "minio-secret"))
      client = described_class.build_client

      expect(client.config.endpoint.to_s).to eq("https://s3.example.com")
      expect(client.config.credentials.credentials).to have_attributes(access_key_id: "k", secret_access_key: "s")
    end

    it "does not fall back to the file storage's login when only half of the other one is set" do
      with_env("BACKUP_S3_ACCESS_KEY" => "k", "MINIO_ACCESS_KEY" => "minio-key", "MINIO_SECRET_KEY" => "minio-secret")

      expect { described_class.build_client }.to raise_error(KeyError)
    end

    it "does not borrow the file storage's access key either, whichever half is missing" do
      with_env("BACKUP_S3_ENDPOINT" => "https://s3.example.com", "BACKUP_S3_SECRET_KEY" => "s", "MINIO_ACCESS_KEY" => "minio-key")

      expect { described_class.build_client }.to raise_error(KeyError, /BACKUP_S3_ACCESS_KEY/)
    end

    it "uses the file storage when nothing else is set" do
      with_env("MINIO_ENDPOINT" => "http://s3:8333", "MINIO_ACCESS_KEY" => "minio-key", "MINIO_SECRET_KEY" => "minio-secret")

      expect(described_class.build_client.config.endpoint.to_s).to eq("http://s3:8333")
    end
  end

  describe ".valid_name?" do
    it "accepts what the nightly job names a backup and nothing else" do
      expect(described_class.valid_name?("fixflow_20261018_030000.sql.gz")).to be(true)
      ["", nil, "../fixflow_20261018_030000.sql.gz", "fixflow_20261018_030000.sql.gz/../x", "fixflow_20261018_030000.sql.gz\n",
       "notes.txt", "fixflow_2026_030000.sql.gz", "backups/fixflow_20261018_030000.sql.gz"].each do |name|
        expect(described_class.valid_name?(name)).to be(false), "#{name.inspect} should not be a backup name"
      end
    end
  end

  describe "#list" do
    it "lists backups newest first, with their size, and leaves out anything that is not a backup" do
      client.stub_responses(:list_objects_v2, contents: [
        object("backups/fixflow_20261016_030000.sql.gz", now - 2.days, size: 100),
        object("backups/fixflow_20261018_030000.sql.gz", now, size: 300),
        object("backups/notes.txt", now),
        object("backups/", now),
        object("backups/fixflow_20261017_030000.sql.gz", now - 1.day, size: 200)
      ])

      expect(store.list.map(&:to_h)).to eq([
        { name: "fixflow_20261018_030000.sql.gz", bytes: 300, created_at: now },
        { name: "fixflow_20261017_030000.sql.gz", bytes: 200, created_at: now - 1.day },
        { name: "fixflow_20261016_030000.sql.gz", bytes: 100, created_at: now - 2.days }
      ])
    end

    it "reads every page of a long listing" do
      client.stub_responses(:list_objects_v2, [
        { contents: [object("backups/fixflow_20261016_030000.sql.gz", now - 2.days)],
          is_truncated: true, next_continuation_token: "t" },
        { contents: [object("backups/fixflow_20261018_030000.sql.gz", now)], is_truncated: false }
      ])

      expect(store.list.map(&:name)).to eq(%w[fixflow_20261018_030000.sql.gz fixflow_20261016_030000.sql.gz])
    end

    it "looks only under backups/ in the backup bucket" do
      expect(client).to receive(:list_objects_v2).with(bucket: described_class.bucket, prefix: "backups/").and_call_original
      store.list
    end
  end

  describe "#delete_older_than" do
    it "deletes the backups made before the time, and nothing else in the bucket" do
      client.stub_responses(:list_objects_v2, contents: [
        object("backups/fixflow_20260901_030000.sql.gz", now - 47.days),
        object("backups/fixflow_20261018_030000.sql.gz", now),
        object("backups/hand_made_copy.sql.gz", now - 90.days)
      ])
      deleted = []
      allow(client).to receive(:delete_object) { |args| deleted << args[:key] }

      expect(store.delete_older_than(now - 30.days)).to eq(["fixflow_20260901_030000.sql.gz"])
      expect(deleted).to eq(["backups/fixflow_20260901_030000.sql.gz"])
    end
  end

  describe "#size and #stream" do
    it "gives the size of a backup and hands over its bytes" do
      client.stub_responses(:head_object, content_length: 5)
      client.stub_responses(:get_object, body: "hello")

      expect(store.size("fixflow_20261018_030000.sql.gz")).to eq(5)
      received = +""
      store.stream("fixflow_20261018_030000.sql.gz") { |chunk| received << chunk }
      expect(received).to eq("hello")
    end

    it "says Missing for a backup that is not there" do
      client.stub_responses(:head_object, "NotFound")
      client.stub_responses(:get_object, "NoSuchKey")

      expect { store.size("fixflow_20261018_030000.sql.gz") }.to raise_error(described_class::Missing)
      expect { store.stream("fixflow_20261018_030000.sql.gz") { nil } }.to raise_error(described_class::Missing)
    end

    it "never asks the storage for a name that is not a backup name" do
      expect(client).not_to receive(:head_object)
      expect(client).not_to receive(:get_object)

      expect { store.size("../../etc/passwd") }.to raise_error(described_class::Missing)
      expect { store.stream("notes.txt") { nil } }.to raise_error(described_class::Missing)
    end
  end
end
