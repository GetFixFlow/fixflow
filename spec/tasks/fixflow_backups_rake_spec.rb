require "rails_helper"
require "rake"

RSpec.describe "fixflow backup rake tasks", type: :task do
  let(:store)  { instance_double(BackupStore, list: []) }
  let(:newest) { BackupStore::Backup.new(name: "fixflow_20261018_030000.sql.gz", bytes: 2_500_000, created_at: Time.utc(2026, 10, 18, 3, 0, 4)) }
  let(:older)  { BackupStore::Backup.new(name: "fixflow_20261017_030000.sql.gz", bytes: 1_000, created_at: Time.utc(2026, 10, 17, 3, 0, 3)) }

  before do
    Rails.application.load_tasks unless Rake::Task.task_defined?("fixflow:backups")
    allow(BackupStore).to receive(:new).and_return(store)
  end

  def run(task, source = nil) = Rake::Task["fixflow:#{task}"].execute(source: source)

  # Runs the block with what the task prints kept out of the test output.
  def quietly
    out = $stdout
    $stdout = StringIO.new
    yield
  ensure
    $stdout = out
  end

  describe "fixflow:backups" do
    it "lists the backups with their size and time" do
      allow(store).to receive(:list).and_return([newest, older])

      expect { run(:backups) }.to output(
        /fixflow_20261018_030000\.sql\.gz\s+2\.38 MB\s+2026-10-18 03:00 UTC\nfixflow_20261017_030000\.sql\.gz/
      ).to_stdout
    end

    it "says so when there are none" do
      expect { run(:backups) }.to output(/No backups in the #{BackupStore.bucket} bucket/).to_stdout
    end

    it "says why when the storage cannot be read" do
      allow(store).to receive(:list).and_raise(Seahorse::Client::NetworkingError.new(Errno::ECONNREFUSED.new, "refused"))

      expect { run(:backups) }.to raise_error(SystemExit).and output(/Could not read the #{BackupStore.bucket} bucket/).to_stderr
    end
  end

  describe "fixflow:restore" do
    let(:dump) do
      Tempfile.new(["dump", ".sql"]).tap do |file|
        file.write("SELECT 1;\n-- PostgreSQL database dump complete\n")
        file.flush
      end
    end
    let(:restore) { instance_double(DatabaseRestore, call: 3) }

    before do
      allow(DatabaseRestore).to receive_messages(migration_status: [:current, []], new: restore)
    end

    after { dump.close! }

    it "needs to be told what to restore" do
      expect { quietly { run(:restore) } }.to raise_error(SystemExit).and output(/Say which backup/).to_stderr
    end

    it "restores a file on disk, and tells how it went" do
      expect(DatabaseRestore).to receive(:new).with(dump.path, replace: false)

      expect { run(:restore, dump.path) }.to output(/Restored 3 tables.*matches this version/m).to_stdout
    end

    it "deletes what is in the database first only when REPLACE=yes" do
      stub_const("ENV", ENV.to_h.merge("REPLACE" => "yes"))
      expect(DatabaseRestore).to receive(:new).with(dump.path, replace: true)

      expect { run(:restore, dump.path) }.to output(/Restored/).to_stdout
    end

    it "fetches a backup from the storage by name" do
      expect(store).to receive(:fetch).with(newest.name, anything) { |_name, path| FileUtils.cp(dump.path, path) }
      expect(DatabaseRestore).to receive(:new) do |path, replace:|
        expect(File.read(path)).to include("dump complete")
        expect(replace).to be(false)
        restore
      end

      expect { run(:restore, newest.name) }.to output(/Fetching #{newest.name}/).to_stdout
    end

    it "restores the newest backup when told 'latest'" do
      allow(store).to receive(:list).and_return([newest, older])
      expect(store).to receive(:fetch).with(newest.name, anything)

      expect { run(:restore, "latest") }.to output(/Restoring the newest backup/).to_stdout
    end

    it "says so when 'latest' is asked and there are no backups" do
      expect { quietly { run(:restore, "latest") } }.to raise_error(SystemExit).and output(/no backup to restore/).to_stderr
    end

    it "does not take a name that is neither a file nor a backup name" do
      expect(store).not_to receive(:fetch)

      expect { quietly { run(:restore, "../../etc/passwd") } }
        .to raise_error(SystemExit).and output(/neither a file nor a backup name/).to_stderr
    end

    it "reports what the restore refused, and warns when the backup is from another version" do
      allow(restore).to receive(:call).and_raise(DatabaseRestore::Refused, "The database is not empty.")
      expect { quietly { run(:restore, dump.path) } }
        .to raise_error(SystemExit).and output(/Not restored: The database is not empty/).to_stderr

      allow(restore).to receive(:call).and_return(3)
      allow(DatabaseRestore).to receive(:migration_status).and_return([:behind, [1, 2]])
      expect { run(:restore, dump.path) }.to output(/2 database changes are still to apply.*rails db:migrate/m).to_stdout
    end
  end
end
