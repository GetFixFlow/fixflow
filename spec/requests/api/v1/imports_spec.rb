require "rails_helper"

RSpec.describe "Api::V1::Imports", type: :request do
  let(:org)        { create(:organization) }
  let(:admin)      { create(:user, :admin, organization: org) }
  let(:manager)    { create(:user, :manager, organization: org) }
  let(:technician) { create(:user, organization: org) }

  def upload(content, name: "data.csv")
    { file: Rack::Test::UploadedFile.new(StringIO.new(content), "text/csv", original_filename: name) }
  end

  def post_import(kind, content, path: "", as: manager)
    post "/api/v1/imports/#{kind}#{path}", params: upload(content), headers: auth_headers_for(as)
  end

  describe "GET /api/v1/imports/:kind/template" do
    it "downloads a CSV to fill in, with the headings and an example" do
      get "/api/v1/imports/parts/template", headers: auth_headers_for(manager)

      expect(response).to have_http_status(:ok)
      expect(response.media_type).to eq("text/csv")
      expect(response.headers["Content-Disposition"]).to include("parts_template.csv")
      expect(response.body.lines.first.strip).to eq("name,sku,quantity_on_hand,reorder_point,unit,unit_cost,location")
      expect(response.body.lines.size).to eq(2)
    end
  end

  describe "POST /api/v1/imports/:kind/preview" do
    it "says what the file would do, and does it to nothing" do
      post_import("parts", "name,sku\nOil filter,OF-1\nBelt,B-2\n", path: "/preview")

      expect(response).to have_http_status(:ok)
      expect(json_body).to include("kind" => "parts", "total_rows" => 2, "error_count" => 0, "created" => 0)
      expect(json_body["preview"].first).to include("name" => "Oil filter")
      expect(json_body.dig("columns", "known")).to eq(%w[name sku])
      expect(org.parts.count).to eq(0)
    end

    it "lists the problems with their row, column and a message" do
      post_import("assets", "name,status\n,bad\n", path: "/preview")

      expect(response).to have_http_status(:ok)
      expect(json_body["error_count"]).to eq(2)
      expect(json_body["errors"]).to include({ "row" => 2, "column" => "name", "message" => "The name is empty." })
    end

    it "shows the columns that will be kept as custom fields" do
      post_import("assets", "name,manufacturer\nPump,Grundfos\n", path: "/preview")

      expect(json_body["columns"]).to eq("known" => ["name"], "custom" => ["manufacturer"])
    end

    it "cuts a very long list of problems short, and says so" do
      stub_const("CsvImport::Base::MAX_ERRORS_SHOWN", 3)

      post_import("assets", "name,status\n#{"A,bad\n" * 6}", path: "/preview")

      expect(json_body).to include("error_count" => 6, "errors_truncated" => true)
      expect(json_body["errors"].size).to eq(3)
    end
  end

  describe "POST /api/v1/imports/:kind" do
    it "creates everything in a clean file and says how many" do
      post_import("parts", "name,sku\nOil filter,OF-1\nBelt,B-2\n")

      expect(response).to have_http_status(:created)
      expect(json_body).to include("created" => 2, "error_count" => 0)
      expect(org.parts.count).to eq(2)
    end

    it "creates nothing, and says why, when a row has a problem" do
      post_import("parts", "name,sku\nOil filter,OF-1\n,B-2\n")

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body["errors"]).to eq([{ "row" => 3, "column" => "name", "message" => "The name is empty." }])
      expect(org.parts.count).to eq(0)
    end

    it "keeps a record of what was imported, and by whom" do
      post_import("locations", "name\nPlant\nAnnex\n", as: admin)

      log = ActivityLog.where(action: "import.locations").last
      expect(log).to have_attributes(user_id: admin.id)
      expect(log.metadata).to include("created" => 2)
    end

    it "brings in a whole site in one file, then assets and parts that use it" do
      post_import("locations", "name,type,parent\nPlant,site,\nFloor 1,floor,Plant\n")
      post_import("assets", "name,location\nPump 1,Plant > Floor 1\n")
      post_import("parts", "name,location\nSeal,Plant > Floor 1\n")

      floor = org.locations.find_by(name: "Floor 1")
      expect([org.assets.first.location, org.parts.first.location]).to eq([floor, floor])
    end
  end

  describe "files that cannot be used" do
    it "asks for a file when there is none" do
      post "/api/v1/imports/parts/preview", headers: auth_headers_for(manager)

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body["error"]).to include("code" => "IMPORT_UNREADABLE", "message" => "Choose a CSV file to upload.")
    end

    it "explains an Excel workbook" do
      post_import("parts", "PK\x03\x04 not a csv", path: "/preview")

      expect(json_body.dig("error", "message")).to include("Save As, CSV")
    end

    it "refuses a file that is too large" do
      stub_const("CsvImport::Base::MAX_BYTES", 10)

      post_import("parts", "name,sku\nOil filter,OF-1\n", path: "/preview")

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body.dig("error", "message")).to include("larger than")
    end

    it "does not know any kind but assets, locations and parts" do
      post_import("users", "name\nA\n", path: "/preview")

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "who may import" do
    it "managers and administrators" do
      [manager, admin].each do |person|
        post_import("parts", "name\nPart #{person.id}\n", as: person)
        expect(response).to have_http_status(:created)
      end
    end

    it "not technicians" do
      post_import("parts", "name\nA\n", as: technician)

      expect(response).to have_http_status(:forbidden)
      expect(org.parts.count).to eq(0)
    end

    it "not people who are signed out" do
      post "/api/v1/imports/parts", params: upload("name\nA\n")

      expect(response).to have_http_status(:unauthorized)
    end

    it "and the template is for them too" do
      get "/api/v1/imports/parts/template", headers: auth_headers_for(technician)

      expect(response).to have_http_status(:forbidden)
    end
  end
end
