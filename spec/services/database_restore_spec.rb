require "rails_helper"
require "open3"
require "tmpdir"

# Restores into real scratch databases with the real psql and pg_dump, never into the test database itself.
RSpec.describe DatabaseRestore do
  before { skip "psql and pg_dump are not installed" unless system("command -v psql pg_dump > /dev/null 2>&1") }

  let(:end_line) { "-- PostgreSQL database dump complete" }
  let(:base)    { ActiveRecord::Base.connection_db_config.configuration_hash }
  let(:made)    { [] }
  let(:dir)     { Dir.mktmpdir("restore_spec") }
  let(:widgets) { "CREATE TABLE widgets(id serial PRIMARY KEY, name text); INSERT INTO widgets(name) VALUES ('Pump'), ('Valve')" }

  after do
    made.each { |name| sql("postgres", "DROP DATABASE IF EXISTS #{name} WITH (FORCE)") }
    FileUtils.remove_entry(dir)
  end

  def env
    { "PGHOST" => base[:host], "PGPORT" => base[:port]&.to_s, "PGUSER" => base[:username], "PGPASSWORD" => base[:password] }.compact
  end

  def sql(database, statement)
    out, status = Open3.capture2e(env, "psql", "-X", "-At", "-v", "ON_ERROR_STOP=1", "--dbname=#{database}", "-c", statement)
    raise "psql failed: #{out}" unless status.success?

    out.strip
  end

  def new_database(statement = nil)
    name = "restore_spec_#{SecureRandom.hex(4)}"
    sql("postgres", "CREATE DATABASE #{name}")
    made << name
    sql(name, statement) if statement
    name
  end

  def config_for(name) = base.merge(database: name)

  # A dump of the database in a file, plain or gzipped; `edit` can change the text first.
  def dump_of(database, gzip: true)
    text, status = Open3.capture2(env, "pg_dump", "--no-owner", "--no-acl", "--dbname=#{database}", binmode: true)
    raise "pg_dump failed" unless status.success?

    text = yield(text) if block_given?
    path = File.join(dir, gzip ? "backup.sql.gz" : "backup.sql")
    gzip ? Zlib::GzipWriter.open(path) { |gz| gz.write(text) } : File.binwrite(path, text)
    path
  end

  def restore(path, into:, replace: false) = described_class.new(path, replace: replace, config: config_for(into)).call

  it "puts a gzipped dump into an empty database, data and all" do
    path = dump_of(new_database("#{widgets}; CREATE TABLE gadgets(id int)"))
    target = new_database

    expect(restore(path, into: target)).to eq(2)
    expect(sql(target, "SELECT string_agg(name, ',' ORDER BY id) FROM widgets")).to eq("Pump,Valve")
    expect(sql(target, "INSERT INTO widgets(name) VALUES ('New') RETURNING id")).to start_with("3") # the sequence came too
  end

  it "reads a plain SQL dump as well (what `make backup` writes)" do
    path = dump_of(new_database(widgets), gzip: false)
    target = new_database

    restore(path, into: target)

    expect(sql(target, "SELECT count(*) FROM widgets")).to eq("2")
  end

  it "restores a dump made under another database user (lines that name the owner or grant privileges are skipped)" do
    owned = "ALTER TABLE public.widgets OWNER TO nobody_by_that_name;\nGRANT ALL ON TABLE public.widgets TO nobody_by_that_name;\n"
    path = dump_of(new_database(widgets)) { |text| text.sub(end_line, "#{owned}#{end_line}") }
    target = new_database

    expect { restore(path, into: target) }.not_to raise_error
    expect(sql(target, "SELECT count(*) FROM widgets")).to eq("2")
  end

  it "keeps data that merely looks like one of those lines" do
    line = "ALTER TABLE public.widgets OWNER TO nobody;"
    path = dump_of(new_database("CREATE TABLE notes(body text); INSERT INTO notes VALUES ('#{line}'), ('kept')"))
    target = new_database

    restore(path, into: target)

    expect(sql(target, "SELECT string_agg(body, '|' ORDER BY body) FROM notes")).to eq("#{line}|kept")
  end

  it "refuses a database that is not empty, and changes nothing" do
    path = dump_of(new_database(widgets))
    target = new_database("CREATE TABLE keep(id int); INSERT INTO keep VALUES (1)")

    expect { restore(path, into: target) }.to raise_error(described_class::Refused, /not empty/)
    expect(sql(target, "SELECT count(*) FROM keep")).to eq("1")
    expect(sql(target, "SELECT to_regclass('public.widgets') IS NULL")).to eq("t")
  end

  it "replaces what is there when asked to" do
    path = dump_of(new_database(widgets))
    target = new_database("CREATE TABLE keep(id int); INSERT INTO keep VALUES (1)")

    restore(path, into: target, replace: true)

    expect(sql(target, "SELECT to_regclass('public.keep') IS NULL")).to eq("t")
    expect(sql(target, "SELECT count(*) FROM widgets")).to eq("2")
  end

  it "rolls everything back when the restore fails half way, so a replace never leaves a half-empty database" do
    path = dump_of(new_database(widgets)) do |text|
      text.sub(end_line, "INSERT INTO table_that_is_not_there VALUES (1);\n#{end_line}")
    end
    target = new_database("CREATE TABLE keep(id int); INSERT INTO keep VALUES (1)")

    expect { restore(path, into: target, replace: true) }.to raise_error(/rolled back.*table_that_is_not_there/m)
    expect(sql(target, "SELECT count(*) FROM keep")).to eq("1")
    expect(sql(target, "SELECT to_regclass('public.widgets') IS NULL")).to eq("t")
  end

  it "refuses a gzipped dump that was cut short before touching the database" do
    path = dump_of(new_database(widgets))
    File.binwrite(path, File.binread(path)[0, File.size(path) - 12])
    target = new_database("CREATE TABLE keep(id int)")

    expect { restore(path, into: target, replace: true) }.to raise_error(described_class::Refused, /cannot be read|not a complete/)
    expect(sql(target, "SELECT to_regclass('public.keep') IS NOT NULL")).to eq("t")
  end

  it "refuses a file that is not a complete dump" do
    path = dump_of(new_database(widgets), gzip: false) { |text| text.sub(end_line, "") }
    target = new_database

    expect { restore(path, into: target) }.to raise_error(described_class::Refused, /not a complete database dump/)
    expect(sql(target, "SELECT to_regclass('public.widgets') IS NULL")).to eq("t")
  end

  it "refuses a path with no file" do
    expect { restore(File.join(dir, "missing.sql.gz"), into: new_database) }.to raise_error(described_class::Refused, /no file/)
  end

  describe "what is left out of a dump" do
    def kept(text)
      lines = []
      restore = described_class.new(File.join(dir, "unused"), config: base)
      restore.send(:each_statement_line, StringIO.new(text)) { |line| lines << line }
      lines
    end

    it "leaves out the setting a server older than 17 refuses (the compose database is 16, the app image's pg_dump is 18)" do
      expect(kept("SET statement_timeout = 0;\nSET transaction_timeout = 0;\nSET lock_timeout = 0;\n"))
        .to eq(["SET statement_timeout = 0;\n", "SET lock_timeout = 0;\n"])
    end

    it "leaves out lines that name an owner or grant a privilege, but not inside the data of a table" do
      text = "ALTER TABLE public.t OWNER TO fixflow;\nGRANT ALL ON TABLE public.t TO fixflow;\nCOPY public.t (a) FROM stdin;\n" \
             "GRANT ALL ON TABLE public.t TO x;\n\\.\nCREATE TABLE public.u (id int);\n"

      expect(kept(text)).to eq(
        ["COPY public.t (a) FROM stdin;\n", "GRANT ALL ON TABLE public.t TO x;\n", "\\.\n", "CREATE TABLE public.u (id int);\n"]
      )
    end
  end

  describe ".migration_status" do
    def versions(in_database, in_code)
      migrations = in_code.map { |version| instance_double(ActiveRecord::MigrationProxy, version: version) }
      context = instance_double(ActiveRecord::MigrationContext, get_all_versions: in_database, migrations: migrations)
      allow(ActiveRecord::Base.connection_pool).to receive(:migration_context).and_return(context)
    end

    it "says the database is current, behind (run db:migrate) or ahead (a newer FixFlow made the backup)" do
      versions([1, 2], [1, 2])
      expect(described_class.migration_status).to eq([:current, []])

      versions([1], [1, 2, 3])
      expect(described_class.migration_status).to eq([:behind, [2, 3]])

      versions([1, 2, 9], [1, 2])
      expect(described_class.migration_status).to eq([:ahead, [9]])
    end

    it "tells a person what to do about each" do
      expect(described_class.migration_advice(:behind, [2, 3])).to include("2 database changes", "rails db:migrate")
      expect(described_class.migration_advice(:ahead, [9])).to include("NEWER FixFlow")
      expect(described_class.migration_advice(:current, [])).to include("matches")
    end
  end
end
