require "rails_helper"
require "tmpdir"

# The lite install has no storage server: with FILE_STORAGE=disk the backups are files in BACKUP_DIR.
RSpec.describe BackupStore, "kept in a folder" do
  let(:folder) { Dir.mktmpdir("fixflow_backups") }
  let(:store)  { described_class.new }
  let(:name)   { "fixflow_20261018_030000.sql.gz" }

  def with_env(values)
    stub_const("ENV", ENV.to_h.except("BACKUP_S3_ACCESS_KEY", "BACKUP_S3_SECRET_KEY", "BACKUP_S3_ENDPOINT", "FILE_STORAGE").merge(values))
  end

  def dump(content = "a dump") = Tempfile.new(["dump", ".sql.gz"]).tap { |file| file.write(content) && file.flush }

  before { with_env("FILE_STORAGE" => "disk", "BACKUP_DIR" => folder) }

  after { FileUtils.remove_entry(folder) }

  it "is how the backups are kept with FILE_STORAGE=disk, unless another S3 storage is set" do
    expect(described_class.disk?).to be(true)
    expect(described_class.location).to eq(folder)
    expect(described_class.place).to eq("the #{folder} folder")

    with_env("FILE_STORAGE" => "disk", "BACKUP_DIR" => folder, "BACKUP_S3_ACCESS_KEY" => "k", "BACKUP_S3_ENDPOINT" => "https://s3.example.com")
    expect(described_class.disk?).to be(false)
    expect(described_class.place).to include("bucket")
  end

  it "is not how they are kept on the full install" do
    with_env({})

    expect(described_class.disk?).to be(false)
  end

  it "puts a backup in the folder, lists it with its size, and gives its bytes back" do
    store.put(name, dump("hello").path)

    expect(store.list.map { |backup| [backup.name, backup.bytes] }).to eq([[name, 5]])
    expect(store.size(name)).to eq(5)
    received = +""
    store.stream(name) { |chunk| received << chunk }
    expect(received).to eq("hello")
  end

  it "lists newest first, and only files that are backups" do
    old = Pathname.new(folder).join("backups", "fixflow_20261001_030000.sql.gz")
    FileUtils.mkdir_p(old.dirname)
    File.write(old, "old")
    File.utime(Time.utc(2026, 10, 1), Time.utc(2026, 10, 1), old)
    store.put(name, dump.path)
    File.write(Pathname.new(folder).join("backups", "notes.txt"), "not a backup")
    File.write(Pathname.new(folder).join("backups", "#{name}.part"), "half written")

    expect(store.list.map(&:name)).to eq([name, "fixflow_20261001_030000.sql.gz"])
  end

  it "lists nothing before the first backup" do
    expect(store.list).to eq([])
  end

  it "never lists a half-written backup: the file is whole when it gets its name" do
    allow(FileUtils).to receive(:cp).and_wrap_original do |original, from, to|
      original.call(from, to)
      expect(store.list).to eq([]) # the copy is there, under another name
    end

    store.put(name, dump.path)

    expect(store.list.map(&:name)).to eq([name])
  end

  it "fetches a backup into a file" do
    store.put(name, dump("restore me").path)
    target = Tempfile.new("fetched")

    store.fetch(name, target.path)

    expect(File.read(target.path)).to eq("restore me")
  end

  it "deletes the backups made before a time, and no others" do
    store.put(name, dump.path)
    old = Pathname.new(folder).join("backups", "fixflow_20260901_030000.sql.gz")
    File.write(old, "old")
    File.utime(Time.utc(2026, 9, 1), Time.utc(2026, 9, 1), old)

    expect(store.delete_older_than(Time.utc(2026, 10, 1))).to eq(["fixflow_20260901_030000.sql.gz"])
    expect(store.list.map(&:name)).to eq([name])
  end

  it "says Missing for a backup that is not there, and never opens a name that is not a backup name" do
    expect { store.size(name) }.to raise_error(described_class::Missing)
    expect { store.stream(name) { nil } }.to raise_error(described_class::Missing)
    File.write(Pathname.new(folder).join("secret.txt"), "x")

    expect { store.size("../secret.txt") }.to raise_error(described_class::Missing)
    expect { store.stream("../../etc/passwd") { nil } }.to raise_error(described_class::Missing)
  end
end
