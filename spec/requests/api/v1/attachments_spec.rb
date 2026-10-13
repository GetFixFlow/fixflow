require "rails_helper"

RSpec.describe "Api::V1::Attachments", type: :request do
  let(:org)        { create(:organization) }
  let(:technician) { create(:user, organization: org) }
  let(:work_order) { create(:work_order, organization: org) }
  let(:path)       { "/api/v1/work_orders/#{work_order.id}/attachments" }

  # A real 1x1 PNG, so the file is recognised by its contents as a photo.
  let(:png) { Base64.decode64("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==") }

  def upload(content: png, name: "leak.png", type: "image/png", **extra)
    file = Rack::Test::UploadedFile.new(StringIO.new(content), type, original_filename: name)
    { attachment: { file: file }, **extra }
  end

  describe "POST /api/v1/work_orders/:id/attachments" do
    it "stores a photo, the way the web app sends it, and lists it with a link that works" do
      post path, params: upload, headers: auth_headers_for(technician)

      expect(response).to have_http_status(:created)
      expect(json_body["data"]).to include("filename" => "leak.png", "content_type" => "image/png")
      url = json_body.dig("data", "url")
      expect(url).to start_with("/api/v1/storage/") # under /api, so the dev proxy and nginx forward it

      get path, headers: auth_headers_for(technician)
      expect(json_body["attachments"].size).to eq(1)

      get url
      expect(response).to have_http_status(:redirect)
    end

    it "also accepts the file as a plain field" do
      file = Rack::Test::UploadedFile.new(StringIO.new(png), "image/png", original_filename: "plain.png")
      post path, params: { file: file }, headers: auth_headers_for(technician)

      expect(response).to have_http_status(:created)
    end

    it "asks for a file when there is none, instead of failing" do
      post path, params: { description: "nothing attached" }, headers: auth_headers_for(technician)

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body.dig("error", "message")).to eq("Choose a file to upload.")
    end

    it "refuses things that are not photos or documents, whatever the file is called" do
      post path, params: upload(content: "<script>alert(1)</script>", name: "photo.png", type: "image/png"),
headers: auth_headers_for(technician)

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body.dig("error", "message")).to eq("That file is not a valid photo.")
      expect(work_order.attachments.count).to eq(0)
    end

    it "refuses a type that is not allowed at all" do
      post path, params: upload(content: "MZ binary", name: "setup.exe", type: "application/x-msdownload"),
headers: auth_headers_for(technician)

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "refuses a file over 10 MB" do
      stub_const("Attachment::MAX_SIZE", 10)

      post path, params: upload, headers: auth_headers_for(technician)

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body.dig("error", "message")).to include("10 MB")
    end

    it "does not store the same photo twice when a phone sends it again" do
      params = upload(client_id: "photo-1")
      post path, params: params, headers: auth_headers_for(technician)
      expect(response).to have_http_status(:created)
      first_id = json_body.dig("data", "id")

      expect {
        post path, params: upload(client_id: "photo-1"), headers: auth_headers_for(technician)
      }.not_to change(Attachment, :count)
      expect(response).to have_http_status(:ok)
      expect(json_body.dig("data", "id")).to eq(first_id)
    end

    it "treats the same client id on another work order as a new photo" do
      other = create(:work_order, organization: org)
      [work_order, other].each do |wo|
        post "/api/v1/work_orders/#{wo.id}/attachments", params: upload(client_id: "same"), headers: auth_headers_for(technician)
      end

      expect(Attachment.where(client_id: "same").count).to eq(2)
    end

    it "requires signing in" do
      post path, params: upload
      expect(response).to have_http_status(:unauthorized)
    end

    it "cannot reach another company's work order" do
      foreign = create(:work_order)
      post "/api/v1/work_orders/#{foreign.id}/attachments", params: upload, headers: auth_headers_for(technician)

      expect(response).to have_http_status(:not_found)
    end
  end
end
