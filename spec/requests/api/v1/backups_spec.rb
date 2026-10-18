require "rails_helper"
require "open3"

RSpec.describe "Backups", type: :request do
  let(:org)     { create(:organization) }
  let!(:admin)  { create(:user, :admin, organization: org) }
  let(:now)     { Time.utc(2026, 10, 18, 12, 0) }
  let(:client)  { Aws::S3::Client.new(stub_responses: true) }
  let(:name)    { "fixflow_20261018_030000.sql.gz" }

  def backup_object(file, at, size: 10) = { key: "backups/#{file}", last_modified: at, size: size }

  def others
    [create(:user, :manager, organization: org), create(:user, organization: org), create(:user, :requester, organization: org)]
  end

  around { |example| travel_to(now) { example.run } }

  before { allow(BackupStore).to receive(:new).and_return(BackupStore.new(client: client)) }

  it "loads in a server that has not used the storage library yet (the Gemfile only requires it on use)" do
    script = "raise 'the storage library is already loaded' if defined?(Aws::S3); Api::V1::BackupsController; puts 'loaded'"
    output, status = Open3.capture2e({ "RAILS_ENV" => "test" }, "bin/rails", "runner", script, chdir: Rails.root.to_s)

    expect(status).to be_success, output
    expect(output).to include("loaded")
  end

  describe "GET /api/v1/backups" do
    def listing(as: admin)
      get "/api/v1/backups", headers: auth_headers_for(as)
      expect(response).to have_http_status(:ok)
      response.parsed_body
    end

    it "is for administrators only, and never stored by a browser" do
      others.each do |person|
        get "/api/v1/backups", headers: auth_headers_for(person)
        expect(response).to have_http_status(:forbidden)
      end
      get "/api/v1/backups"
      expect(response).to have_http_status(:unauthorized)
      listing
      expect(response.headers["Cache-Control"]).to include("no-store")
    end

    it "lists the backups newest first, with their size, and the bucket they are in" do
      client.stub_responses(:list_objects_v2, contents: [
        backup_object("fixflow_20261016_030000.sql.gz", now - 2.days - 9.hours, size: 100),
        backup_object("fixflow_20261018_030000.sql.gz", now - 9.hours, size: 300)
      ])

      body = listing

      expect(body["bucket"]).to eq(BackupStore.bucket)
      expect(body["error"]).to be_nil
      expect(body["backups"]).to eq([
        { "name" => "fixflow_20261018_030000.sql.gz", "bytes" => 300, "created_at" => (now - 9.hours).iso8601(3) },
        { "name" => "fixflow_20261016_030000.sql.gz", "bytes" => 100, "created_at" => (now - 2.days - 9.hours).iso8601(3) }
      ])
    end

    it "answers normally, with an error to show, when the file storage does not answer" do
      client.stub_responses(:list_objects_v2, "ServiceUnavailable")

      body = listing

      expect(body["backups"]).to eq([])
      expect(body["error"]).to match(/file storage did not answer.*ServiceUnavailable/)
    end

    it "answers the same way when the storage is not set up at all" do
      allow(BackupStore).to receive(:new).and_return(instance_double(BackupStore))
      allow(BackupStore.new).to receive(:list).and_raise(KeyError, "key not found: MINIO_ACCESS_KEY_ID")

      expect(listing["error"]).to match(/file storage did not answer/)
    end

    describe "overdue" do
      before { allow(DatabaseBackupJob).to receive(:runs_here?).and_return(true) }

      def overdue_with(*files)
        client.stub_responses(:list_objects_v2, contents: files)
        listing["overdue"]
      end

      it "is true when the newest backup is more than a night and a bit old" do
        expect(overdue_with(backup_object(name, now - 27.hours))).to be(true)
        expect(overdue_with(backup_object(name, now - 25.hours))).to be(false)
      end

      it "is true when there is no backup and the company is older than that, false on its first day" do
        org.update!(created_at: now - 2.days)
        expect(overdue_with).to be(true)
        org.update!(created_at: now - 2.hours)
        expect(overdue_with).to be(false)
      end

      it "is never true on a server that makes no backups" do
        allow(DatabaseBackupJob).to receive(:runs_here?).and_return(false)
        org.update!(created_at: now - 2.days)

        expect(overdue_with).to be(false)
      end
    end
  end

  describe "GET /api/v1/backups/:name/download" do
    let(:content) { Random.new(1).bytes(300_000) }

    before do
      client.stub_responses(:head_object, content_length: content.bytesize)
      client.stub_responses(:get_object, body: content)
    end

    def download(file = name, as: admin)
      get "/api/v1/backups/#{file}/download", headers: auth_headers_for(as)
    end

    it "is for administrators only, and gives nothing to anyone else" do
      others.each do |person|
        download(as: person)
        expect(response).to have_http_status(:forbidden)
        expect(response.body).not_to include(content[0, 20])
      end
      get "/api/v1/backups/#{name}/download"
      expect(response).to have_http_status(:unauthorized)
      expect(ActivityLog.where(action: "backup.downloaded")).to be_none
    end

    it "sends the file as it is in the storage, as a download that is not kept by browsers or proxies" do
      download

      expect(response).to have_http_status(:ok)
      expect(response.body.b).to eq(content)
      expect(response.headers["Content-Type"]).to eq("application/gzip")
      expect(response.headers["Content-Length"]).to eq(content.bytesize.to_s)
      expect(response.headers["Content-Disposition"]).to include("attachment", name)
      expect(response.headers["Cache-Control"]).to include("no-store")
    end

    it "writes the download to the audit log: who took a copy of everything, and which" do
      download

      line = ActivityLog.find_by!(action: "backup.downloaded")
      expect(line.user).to eq(admin)
      expect(line.metadata).to eq("name" => name)
      expect(line.ip_address).to be_present
    end

    it "says 404 for a backup that is not there, and logs nothing" do
      client.stub_responses(:head_object, "NotFound")

      download

      expect(response).to have_http_status(:not_found)
      expect(ActivityLog.where(action: "backup.downloaded")).to be_none
    end

    it "does not even ask the storage for a name that is not a backup name" do
      expect(client).not_to receive(:head_object)

      download("notes.txt")

      expect(response).to have_http_status(:not_found)
    end

    it "says the storage is out of reach rather than failing with a server error" do
      client.stub_responses(:head_object, "ServiceUnavailable")

      download

      expect(response).to have_http_status(:bad_gateway)
      expect(response.parsed_body.dig("error", "code")).to eq("STORAGE_UNAVAILABLE")
    end
  end
end
