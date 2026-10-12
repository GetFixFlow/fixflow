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

    it "raises when pg_dump fails" do
      allow(ENV).to receive(:fetch).and_call_original
      allow(ENV).to receive(:fetch).with("DATABASE_URL").and_return(database_url.sub(%r{/[^/]+\z}, "/no_such_database"))

      expect { described_class.new.send(:run_dump, path) }.to raise_error(/pg_dump failed/)
    end
  end
end
