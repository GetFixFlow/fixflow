require "rails_helper"

RSpec.describe "Api::V1::AssetDocuments", type: :request do
  let(:org)        { create(:organization) }
  let(:manager)    { create(:user, :manager, organization: org) }
  let(:technician) { create(:user, organization: org) }
  let(:requester)  { create(:user, :requester, organization: org) }
  let(:asset)      { create(:asset, organization: org) }
  let(:path)       { "/api/v1/assets/#{asset.id}/documents" }

  let(:png) { Base64.decode64("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==") }

  def upload(content: "%PDF-1.4 manual", name: "pump-manual.pdf", type: "application/pdf", **extra)
    { document: { file: Rack::Test::UploadedFile.new(StringIO.new(content), type, original_filename: name) }, **extra }
  end

  def add(by: technician, **options)
    post path, params: upload(**options), headers: auth_headers_for(by)
    response
  end

  describe "POST /api/v1/assets/:id/documents" do
    it "keeps a manual with the asset, who added it and a note, and lists it with a link that opens it" do
      add(description: "Pump manual, 2019 edition")

      expect(response).to have_http_status(:created)
      expect(json_body["data"]).to include("filename" => "pump-manual.pdf", "content_type" => "application/pdf",
                                           "description" => "Pump manual, 2019 edition", "user" => include("id" => technician.id))

      get path, headers: auth_headers_for(technician)
      expect(json_body["documents"].pluck("filename")).to eq(["pump-manual.pdf"])

      get json_body.dig("documents", 0, "url")
      expect(response).to have_http_status(:ok)
      expect(response.body).to eq("%PDF-1.4 manual")
    end

    it "keeps a photo of the nameplate" do
      add(content: png, name: "nameplate.png", type: "image/png")

      expect(response).to have_http_status(:created)
    end

    it "refuses a file that says it is a photo and is not" do
      add(content: "<script>alert(1)</script>", name: "photo.png", type: "image/png")

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body.dig("error", "message")).to eq("That file is not a valid photo.")
      expect(asset.documents.count).to eq(0)
    end

    it "refuses a type that is not allowed" do
      add(content: "MZ", name: "setup.exe", type: "application/x-msdownload")

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body.dig("error", "message")).to eq("File must be a photo, PDF or Word document")
    end

    it "refuses a file over 10 MB" do
      stub_const("AssetDocument::MAX_SIZE", 10)

      add(content: "%PDF-1.4 a longer manual")

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body.dig("error", "message")).to eq("File must be 10 MB or smaller")
    end

    it "asks for a file when there is none" do
      post path, params: { description: "nothing" }, headers: auth_headers_for(technician)

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body.dig("error", "message")).to eq("Choose a file to upload.")
    end

    it "is closed to a person who can only ask for work" do
      add(by: requester)

      expect(response).to have_http_status(:forbidden)
    end

    it "does not reach another company's asset, nor one that is put away" do
      other = create(:asset, organization: create(:organization))
      post "/api/v1/assets/#{other.id}/documents", params: upload, headers: auth_headers_for(manager)
      expect(response).to have_http_status(:not_found)

      asset.discard!
      add(by: manager)
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "GET /api/v1/assets/:id/documents" do
    it "lists the newest first, and only this asset's" do
      older = create(:asset_document, asset: asset, created_at: 2.days.ago)
      newer = create(:asset_document, asset: asset)
      create(:asset_document)

      get path, headers: auth_headers_for(technician)

      expect(json_body["documents"].pluck("id")).to eq([newer.id, older.id])
    end

    it "is closed to a person who can only ask for work" do
      get path, headers: auth_headers_for(requester)

      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "DELETE /api/v1/asset_documents/:id" do
    let!(:document) { create(:asset_document, asset: asset, user: technician) }

    it "lets the person who added it take it away, and removes the file" do
      blob = document.file.blob

      delete "/api/v1/asset_documents/#{document.id}", headers: auth_headers_for(technician)

      expect(response).to have_http_status(:no_content)
      expect(AssetDocument.exists?(document.id)).to be(false)
      perform_enqueued_jobs { ActiveStorage::Blob.find_by(id: blob.id)&.purge }
    end

    it "lets a manager take away anybody's" do
      delete "/api/v1/asset_documents/#{document.id}", headers: auth_headers_for(manager)

      expect(response).to have_http_status(:no_content)
    end

    it "does not let another technician" do
      delete "/api/v1/asset_documents/#{document.id}", headers: auth_headers_for(create(:user, organization: org))

      expect(response).to have_http_status(:forbidden)
      expect(AssetDocument.exists?(document.id)).to be(true)
    end

    it "does not reach another company's" do
      foreign = create(:asset_document)

      delete "/api/v1/asset_documents/#{foreign.id}", headers: auth_headers_for(manager)

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "the warranty date on the asset" do
    it "is saved by a manager and shown with the asset" do
      patch "/api/v1/assets/#{asset.id}", params: { asset: { warranty_expires_on: "2027-03-01" } }, headers: auth_headers_for(manager)

      expect(response).to have_http_status(:ok)
      expect(json_body.dig("data", "warranty_expires_on")).to eq("2027-03-01")
      get "/api/v1/assets/#{asset.id}", headers: auth_headers_for(technician)
      expect(json_body.dig("data", "warranty_expires_on")).to eq("2027-03-01")
    end

    it "is written in the audit log when it changes" do
      patch "/api/v1/assets/#{asset.id}", params: { asset: { warranty_expires_on: "2027-03-01" } }, headers: auth_headers_for(manager)

      log = ActivityLog.where(resource_type: "Asset", resource_id: asset.id, action: "asset.updated").last
      expect(log.metadata["changed"]).to eq(["warranty_expires_on"])
    end

    it "can be cleared" do
      asset.update!(warranty_expires_on: Date.new(2027, 3, 1))

      patch "/api/v1/assets/#{asset.id}", params: { asset: { warranty_expires_on: nil } }, headers: auth_headers_for(manager)

      expect(json_body.dig("data", "warranty_expires_on")).to be_nil
    end

    it "is not for a technician to change" do
      patch "/api/v1/assets/#{asset.id}", params: { asset: { warranty_expires_on: "2027-03-01" } },
                                          headers: auth_headers_for(technician)

      expect(response).to have_http_status(:forbidden)
    end
  end
end
