require "rails_helper"
require "tmpdir"

# The lite install keeps the backups in a folder (FILE_STORAGE=disk), not in a bucket.
RSpec.describe "Backups in a folder", type: :request do
  let(:org)    { create(:organization) }
  let(:admin)  { create(:user, :admin, organization: org) }
  let(:folder) { Dir.mktmpdir("fixflow_backups") }
  let(:name)   { "fixflow_20261018_030000.sql.gz" }

  before do
    here = { "FILE_STORAGE" => "disk", "BACKUP_DIR" => folder }
    stub_const("ENV", ENV.to_h.except("BACKUP_S3_ACCESS_KEY", "BACKUP_S3_ENDPOINT").merge(here))
    FileUtils.mkdir_p(File.join(folder, "backups"))
    File.write(File.join(folder, "backups", name), "gzipped dump")
  end

  after { FileUtils.remove_entry(folder) }

  it "lists them, and says the place is the folder" do
    get "/api/v1/backups", headers: auth_headers_for(admin)

    expect(response).to have_http_status(:ok)
    expect(response.parsed_body).to include("bucket" => folder, "error" => nil)
    expect(response.parsed_body["backups"].map { |backup| backup.values_at("name", "bytes") }).to eq([[name, 12]])
  end

  it "downloads one, and writes the download to the audit log" do
    expect { get "/api/v1/backups/#{name}/download", headers: auth_headers_for(admin) }
      .to change { ActivityLog.where(action: "backup.downloaded").count }.by(1)

    expect(response).to have_http_status(:ok)
    expect(response.body).to eq("gzipped dump")
    expect(response.headers["Content-Length"]).to eq("12")
  end

  it "answers 404 for a backup that is not there" do
    get "/api/v1/backups/fixflow_20200101_000000.sql.gz/download", headers: auth_headers_for(admin)

    expect(response).to have_http_status(:not_found)
  end

  it "says the folder could not be read, not that a storage server did not answer" do
    allow_any_instance_of(BackupStore).to receive(:list).and_raise(Errno::EACCES) # rubocop:disable RSpec/AnyInstance

    get "/api/v1/backups", headers: auth_headers_for(admin)

    expect(response.parsed_body["error"]).to include("backups folder could not be read")
  end
end
