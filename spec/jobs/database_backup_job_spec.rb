require "rails_helper"
require "zlib"

RSpec.describe DatabaseBackupJob, type: :job do
  let(:path) { Rails.root.join("tmp/backup_spec_#{SecureRandom.hex(4)}.sql.gz").to_s }

  after { FileUtils.rm_f(path) }

  def database_url
    c = ActiveRecord::Base.connection_db_config.configuration_hash
    "postgres://#{c[:username]}:#{c[:password]}@#{c[:host] || 'localhost'}:#{c[:port] || 5432}/#{c[:database]}"
  end

  describe "#run_dump" do
    before { skip "pg_dump is not installed" unless system("command -v pg_dump > /dev/null 2>&1") }

    it "writes a gzipped SQL dump of the database" do
      allow(ENV).to receive(:fetch).and_call_original
      allow(ENV).to receive(:fetch).with("DATABASE_URL").and_return(database_url)

      described_class.new.send(:run_dump, path)

      sql = Zlib::GzipReader.open(path, &:read)
      expect(sql).to include("PostgreSQL database dump")
    end

    it "leaves out who owns what, so the backup restores under any database user" do
      allow(ENV).to receive(:fetch).and_call_original
      allow(ENV).to receive(:fetch).with("DATABASE_URL").and_return(database_url)

      described_class.new.send(:run_dump, path)

      expect(Zlib::GzipReader.open(path, &:read)).not_to match(/OWNER TO|^GRANT |^REVOKE /)
    end

    it "raises when pg_dump fails" do
      allow(ENV).to receive(:fetch).and_call_original
      allow(ENV).to receive(:fetch).with("DATABASE_URL").and_return(database_url.sub(%r{/[^/]+\z}, "/no_such_database"))

      expect { described_class.new.send(:run_dump, path) }.to raise_error(/pg_dump failed/)
    end
  end

  describe "#perform" do
    let(:store) { instance_double(BackupStore, put: nil, delete_older_than: []) }

    before do
      allow(BackupStore).to receive(:new).and_return(store)
      allow(described_class).to receive(:runs_here?).and_return(true)
      allow_any_instance_of(described_class).to receive(:run_dump) { |_job, file| File.write(file, "dump") } # rubocop:disable RSpec/AnyInstance
    end

    it "uploads the dump under a dated name, deletes backups older than 30 days, and leaves no copy on the server's disk" do
      uploaded = nil
      allow(store).to receive(:put) { |name, file| uploaded = [name, File.exist?(file)] }
      expect(store).to receive(:delete_older_than) do |time|
        expect(time).to be_within(1.minute).of(30.days.ago)
        []
      end

      described_class.perform_now

      expect(uploaded.first).to match(/\Afixflow_\d{8}_\d{6}\.sql\.gz\z/)
      expect(uploaded.last).to be(true)
      expect(Rails.root.glob("tmp/fixflow_*.sql.gz")).to be_empty
    end

    it "does nothing when this server does not make backups" do
      allow(described_class).to receive(:runs_here?).and_return(false)
      expect(store).not_to receive(:put)

      described_class.perform_now
    end
  end

  describe "when the backup fails" do
    include ActiveJob::TestHelper

    let!(:org)       { create(:organization) }
    let!(:admin)     { create(:user, :admin, organization: org) }
    let!(:admin_two) { create(:user, :admin, organization: org) }
    let(:store)      { instance_double(BackupStore) }
    let(:tries)      { [] }

    around do |example|
      previous = ActiveJob::Base.queue_adapter
      ActiveJob::Base.queue_adapter = :test
      example.run
      ActiveJob::Base.queue_adapter = previous
    end

    before do
      create(:user, :manager, organization: org)
      create(:user, :admin, organization: org, deactivated_at: 1.day.ago)
      ActionMailer::Base.deliveries.clear
      allow(described_class).to receive(:runs_here?).and_return(true)
      allow_any_instance_of(described_class).to receive(:run_dump) do # rubocop:disable RSpec/AnyInstance
        tries << 1
        raise "pg_dump failed"
      end
    end

    it "tries again later and tells nobody after the first failure" do
      described_class.perform_now

      expect(tries.size).to eq(1)
      expect(enqueued_jobs.pluck("job_class")).to eq(["DatabaseBackupJob"])
      expect(ActionMailer::Base.deliveries).to be_empty
      expect(ActivityLog.where(action: "backup.failed")).to be_none
    end

    it "after the last try emails every active administrator once, and writes it to the audit log" do
      perform_enqueued_jobs { described_class.perform_later }

      expect(tries.size).to eq(DatabaseBackupJob::ATTEMPTS)
      expect(ActionMailer::Base.deliveries.flat_map(&:to)).to contain_exactly(admin.email, admin_two.email)
      expect(ActionMailer::Base.deliveries.first.body.encoded).to include("pg_dump failed")
      line = ActivityLog.find_by!(action: "backup.failed")
      expect(line.user_id).to be_nil
      expect(line.metadata).to include("error" => "RuntimeError: pg_dump failed", "attempts" => DatabaseBackupJob::ATTEMPTS)
    end

    it "leaves the password out of what it reports" do
      allow_any_instance_of(described_class).to receive(:run_dump).and_raise("could not connect to postgres://fixflow:s3cret@db/app") # rubocop:disable RSpec/AnyInstance

      perform_enqueued_jobs { described_class.perform_later }

      body = ActionMailer::Base.deliveries.first.body.encoded
      expect(body).to include("postgres://db/app")
      expect(body).not_to include("s3cret")
      expect(ActivityLog.find_by!(action: "backup.failed").metadata.to_s).not_to include("s3cret")
    end

    it "still writes the audit line when an email cannot be queued" do
      allow(BackupMailer).to receive(:failed).and_raise("Redis is down")

      expect { perform_enqueued_jobs { described_class.perform_later } }.not_to raise_error
      expect(ActivityLog.where(action: "backup.failed").count).to eq(1)
    end
  end
end
