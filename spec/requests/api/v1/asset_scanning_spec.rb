require "rails_helper"

# Finding an asset from a scanned code, the barcode field, and the data for a sheet of labels.
RSpec.describe "Asset scanning and labels", type: :request do
  let(:org)        { create(:organization) }
  let(:manager)    { create(:user, :manager, organization: org) }
  let(:technician) { create(:user, organization: org) }
  let(:plant)      { create(:location, organization: org, name: "Plant") }
  let(:floor)      { create(:location, organization: org, name: "Floor 1", parent: plant) }
  let(:annex)      { create(:location, organization: org, name: "Annex") }

  def get_as(user, url, params = {}) = get(url, params: params, headers: auth_headers_for(user))

  def send_json(verb, url, body, as: manager)
    public_send(verb, url, params: body.to_json, headers: auth_headers_for(as).merge("Content-Type" => "application/json"))
  end

  describe "GET /assets/lookup" do
    let!(:pump) { create(:asset, organization: org, name: "Pump 3", asset_tag: "FF-000042", barcode: "5012345678900", location: floor) }

    it "gives the asset a code belongs to, for any signed-in person who can scan" do
      [technician, manager].each do |person|
        get_as person, "/api/v1/assets/lookup", code: "5012345678900"

        expect(response).to have_http_status(:ok)
        expect(json_body["matches"].sole).to include("id" => pump.id, "name" => "Pump 3", "matched_on" => ["barcode"],
"location" => "Floor 1")
      end
    end

    it "reads one of our labels' links" do
      get_as technician, "/api/v1/assets/lookup", code: "https://x.test/request?asset=#{pump.public_code}"

      expect(json_body["matches"].sole).to include("id" => pump.id, "matched_on" => ["label"])
    end

    it "gives an empty list for a code nobody has, and for none at all" do
      get_as technician, "/api/v1/assets/lookup", code: "NOPE"
      expect(json_body["matches"]).to eq([])

      get_as technician, "/api/v1/assets/lookup"
      expect(response).to have_http_status(:ok)
      expect(json_body["matches"]).to eq([])
    end

    it "does not give another company's asset" do
      create(:asset, barcode: "OTHER-1")
      get_as technician, "/api/v1/assets/lookup", code: "OTHER-1"

      expect(json_body["matches"]).to eq([])
    end
  end

  describe "the barcode on an asset" do
    let!(:pump) { create(:asset, organization: org, name: "Pump 3") }

    it "is saved by a manager, shown in the answer, and found by the list's search" do
      send_json :patch, "/api/v1/assets/#{pump.id}", { asset: { barcode: " 5012345678900 " } }

      expect(response).to have_http_status(:ok)
      expect(json_body.dig("data", "barcode")).to eq("5012345678900")
      get_as technician, "/api/v1/assets", search: "5678"
      expect(json_body["assets"].pluck("id")).to eq([pump.id])
    end

    it "is cleared by sending it empty" do
      pump.update!(barcode: "ABC")
      send_json :patch, "/api/v1/assets/#{pump.id}", { asset: { barcode: "" } }

      expect(pump.reload.barcode).to be_nil
    end

    it "can be set when the asset is made" do
      send_json :post, "/api/v1/assets", { asset: { name: "Fan", barcode: "FAN-1" } }

      expect(response).to have_http_status(:created)
      expect(json_body.dig("data", "barcode")).to eq("FAN-1")
    end

    it "is refused when another asset has it, saying so, and the asset is left as it was" do
      create(:asset, organization: org, barcode: "TAKEN")
      send_json :patch, "/api/v1/assets/#{pump.id}", { asset: { barcode: "taken", name: "Changed" } }

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body.dig("error", "message")).to eq("Barcode is already on another asset")
      expect(pump.reload).to have_attributes(barcode: nil, name: "Pump 3")
    end

    it "is for managers" do
      send_json :patch, "/api/v1/assets/#{pump.id}", { asset: { barcode: "ABC" } }, as: technician

      expect(response).to have_http_status(:forbidden)
      expect(pump.reload.barcode).to be_nil
    end

    it "is shown on the asset's own page" do
      pump.update!(barcode: "ABC")
      get_as technician, "/api/v1/assets/#{pump.id}"

      expect(json_body.dig("data", "barcode")).to eq("ABC")
    end
  end

  describe "GET /assets/labels" do
    let!(:pump) { create(:asset, organization: org, name: "Pump", location: floor, barcode: "P-1") }
    let!(:fan)  { create(:asset, organization: org, name: "Fan", location: annex, status: "down") }
    let!(:belt) { create(:asset, organization: org, name: "Belt", location: plant) }

    def label_names = json_body["labels"].pluck("name")

    it "gives what a label needs, by name" do
      get_as manager, "/api/v1/assets/labels"

      expect(response).to have_http_status(:ok)
      expect(label_names).to eq(%w[Belt Fan Pump])
      expect(json_body["labels"].find { |l| l["name"] == "Pump" })
        .to eq("id" => pump.id, "name" => "Pump", "asset_tag" => pump.asset_tag, "barcode" => "P-1", "public_code" => pump.public_code,
               "location_name" => "Floor 1")
      expect(json_body).to include("total" => 3, "truncated" => false)
    end

    it "can be limited to the assets chosen" do
      get_as manager, "/api/v1/assets/labels", ids: "#{pump.id},#{fan.id},abc,"

      expect(label_names).to eq(%w[Fan Pump])
    end

    it "takes a place to include the places inside it" do
      get_as manager, "/api/v1/assets/labels", location_id: plant.id

      expect(label_names).to eq(%w[Belt Pump])
    end

    it "can be limited by status and by search" do
      get_as manager, "/api/v1/assets/labels", status: "down"
      expect(label_names).to eq(["Fan"])

      get_as manager, "/api/v1/assets/labels", search: "pum"
      expect(label_names).to eq(["Pump"])
    end

    it "leaves out assets that are put away and another company's" do
      belt.discard!
      create(:asset, name: "Elsewhere")
      get_as manager, "/api/v1/assets/labels"

      expect(label_names).to eq(%w[Fan Pump])
    end

    it "does not take another company's place" do
      get_as manager, "/api/v1/assets/labels", location_id: create(:location).id

      expect(response).to have_http_status(:not_found)
    end

    it "holds at most 500 labels" do
      expect(Api::V1::AssetsController::LABEL_LIMIT).to eq(500)
    end

    it "does not say there were more when there are exactly as many as it holds" do
      stub_const("Api::V1::AssetsController::LABEL_LIMIT", 3)
      get_as manager, "/api/v1/assets/labels"

      expect(json_body["labels"].size).to eq(3)
      expect(json_body).to include("total" => 3, "truncated" => false)
    end

    it "stops at 500 and says there were more" do
      stub_const("Api::V1::AssetsController::LABEL_LIMIT", 2)
      get_as manager, "/api/v1/assets/labels"

      expect(json_body["labels"].size).to eq(2)
      expect(json_body).to include("total" => 3, "truncated" => true)
    end

    it "is for managers" do
      get_as technician, "/api/v1/assets/labels"

      expect(response).to have_http_status(:forbidden)
    end
  end
end
