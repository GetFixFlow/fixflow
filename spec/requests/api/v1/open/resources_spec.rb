require "rails_helper"

RSpec.describe "Public API: reading", type: :request do
  let(:org) { create(:organization) }
  let(:other_org) { create(:organization) }
  let(:raw) { make_key(org, scopes: %w[read]).last }
  let(:headers) { bearer(raw) }

  describe "work orders" do
    let(:asset) { create(:asset, organization: org, name: "Pump 3") }
    let(:tech) { create(:user, organization: org, first_name: "Tia", last_name: "Nguyen") }

    it "lists them with the fields programs need, and none of what people are paid" do
      create(:work_order, organization: org, title: "Leak", asset: asset, assignee: tech, status: "assigned", priority: "high")

      get "/api/v1/open/work_orders", headers: headers

      row = json_body["data"].first
      expect(row).to include("title" => "Leak", "status" => "assigned", "priority" => "high", "number" => be_present,
                             "asset" => { "id" => asset.id, "name" => "Pump 3", "asset_tag" => asset.asset_tag },
                             "assignee" => { "id" => tech.id, "name" => "Tia Nguyen", "email" => tech.email },
                             "url" => "#{EmailSetup.base_url}/work-orders/#{row['id']}")
      expect(row.keys).not_to include("labor_cost", "labor_rate", "parts_cost", "expected_cost", "approved_cost", "hourly_rate")
      expect(response.body).not_to include("hourly_rate")
    end

    it "pages, with the page in meta, and takes per_page up to 100" do
      create_list(:work_order, 30, organization: org)

      get "/api/v1/open/work_orders", headers: headers
      expect(json_body["data"].size).to eq(25)
      expect(json_body["meta"]).to eq("page" => 1, "per_page" => 25, "total_count" => 30, "total_pages" => 2)

      get "/api/v1/open/work_orders?per_page=10&page=3", headers: headers
      expect(json_body["data"].size).to eq(10)
      expect(json_body["meta"]).to include("page" => 3, "per_page" => 10, "total_pages" => 3)

      get "/api/v1/open/work_orders?per_page=5000", headers: headers
      expect(json_body["meta"]["per_page"]).to eq(100)
      get "/api/v1/open/work_orders?per_page=0", headers: headers
      expect(json_body["meta"]["per_page"]).to eq(1)
    end

    it "filters by status, priority, asset, assignee and text" do
      a = create(:work_order, organization: org, title: "Belt squeals", status: "open", priority: "low", asset: asset)
      b = create(:work_order, organization: org, title: "Motor hot", status: "assigned", priority: "high", assignee: tech)
      get "/api/v1/open/work_orders?status=assigned,in_progress", headers: headers
      expect(json_body["data"].pluck("id")).to eq([b.id])
      get "/api/v1/open/work_orders?priority=low", headers: headers
      expect(json_body["data"].pluck("id")).to eq([a.id])
      get "/api/v1/open/work_orders?asset_id=#{asset.id}", headers: headers
      expect(json_body["data"].pluck("id")).to eq([a.id])
      get "/api/v1/open/work_orders?assignee_id=#{tech.id}", headers: headers
      expect(json_body["data"].pluck("id")).to eq([b.id])
      get "/api/v1/open/work_orders?q=motor", headers: headers
      expect(json_body["data"].pluck("id")).to eq([b.id])
    end

    it "answers what changed since a time, oldest first, so a program can poll" do
      old = create(:work_order, organization: org, title: "Old")
      old.update_columns(updated_at: 3.days.ago, created_at: 3.days.ago) # rubocop:disable Rails/SkipsModelValidations
      fresh = create(:work_order, organization: org, title: "Fresh")
      fresher = create(:work_order, organization: org, title: "Fresher")
      fresher.update_columns(updated_at: 1.minute.from_now) # rubocop:disable Rails/SkipsModelValidations

      get "/api/v1/open/work_orders", params: { updated_since: 1.day.ago.iso8601, sort: "updated_at" }, headers: headers

      expect(json_body["data"].pluck("id")).to eq([fresh.id, fresher.id])
      get "/api/v1/open/work_orders", params: { created_since: 1.day.ago.iso8601, sort: "-updated_at" }, headers: headers
      expect(json_body["data"].pluck("id")).to eq([fresher.id, fresh.id])
    end

    it "says in words when a time cannot be read" do
      get "/api/v1/open/work_orders?updated_since=yesterday-ish", headers: headers

      expect(response).to have_http_status(:bad_request)
      expect(json_body.dig("error", "message")).to include("updated_since")
    end

    it "shows one, and 404s for another company's" do
      mine = create(:work_order, organization: org)
      theirs = create(:work_order, organization: other_org)

      get "/api/v1/open/work_orders/#{mine.id}", headers: headers
      expect(json_body.dig("data", "id")).to eq(mine.id)

      get "/api/v1/open/work_orders/#{theirs.id}", headers: headers
      expect(response).to have_http_status(:not_found)
      expect(json_body.dig("error", "code")).to eq("RESOURCE_NOT_FOUND")
    end

    it "shows who asked when it came in from a label or a program, with no person" do
      create(:work_order, organization: org, requester: nil, requester_name: "Visitor", requester_email: "v@example.test")

      get "/api/v1/open/work_orders", headers: headers

      expect(json_body["data"].first["requester"]).to eq("id" => nil, "name" => "Visitor", "email" => "v@example.test")
    end
  end

  describe "assets" do
    it "lists them without the deleted ones, filters, and shows the location" do # rubocop:disable RSpec/ExampleLength
      room = create(:location, organization: org, name: "Boiler room")
      up = create(:asset, organization: org, name: "Boiler", status: "operational", location: room)
      down = create(:asset, organization: org, name: "Chiller", status: "down")
      gone = create(:asset, organization: org, name: "Scrapped")
      gone.discard

      get "/api/v1/open/assets", headers: headers
      expect(json_body["data"].pluck("id")).to contain_exactly(up.id, down.id)
      expect(json_body["data"].find { |a| a["id"] == up.id }["location"]).to eq("id" => room.id, "name" => "Boiler room")

      get "/api/v1/open/assets?status=down", headers: headers
      expect(json_body["data"].pluck("id")).to eq([down.id])
      get "/api/v1/open/assets?location_id=#{room.id}", headers: headers
      expect(json_body["data"].pluck("id")).to eq([up.id])
      get "/api/v1/open/assets?q=chill", headers: headers
      expect(json_body["data"].pluck("id")).to eq([down.id])

      get "/api/v1/open/assets/#{gone.id}", headers: headers
      expect(response).to have_http_status(:not_found)
    end

    it "does not show another company's" do
      theirs = create(:asset, organization: other_org)

      get "/api/v1/open/assets", headers: headers
      expect(json_body["data"]).to be_empty
      get "/api/v1/open/assets/#{theirs.id}", headers: headers
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "locations and parts" do
    it "lists the company's locations, with their parent" do
      site = create(:location, organization: org, name: "Plant")
      room = create(:location, organization: org, name: "Boiler room", parent: site)
      create(:location, organization: other_org, name: "Elsewhere")

      get "/api/v1/open/locations", headers: headers

      expect(json_body["data"].pluck("name")).to contain_exactly("Plant", "Boiler room")
      expect(json_body["data"].find { |l| l["id"] == room.id }["parent_id"]).to eq(site.id)
      get "/api/v1/open/locations/#{room.id}", headers: headers
      expect(json_body.dig("data", "name")).to eq("Boiler room")
    end

    it "lists parts, says which are low, and can list only those" do
      low = create(:part, organization: org, name: "Belt", quantity_on_hand: 1, reorder_point: 2)
      fine = create(:part, organization: org, name: "Bolt", quantity_on_hand: 50, reorder_point: 2)
      create(:part, organization: other_org, name: "Theirs")

      get "/api/v1/open/parts", headers: headers
      expect(json_body["data"].pluck("name")).to contain_exactly("Belt", "Bolt")
      expect(json_body["data"].find { |p| p["id"] == low.id }["low_stock"]).to be(true)
      expect(json_body["data"].find { |p| p["id"] == fine.id }["low_stock"]).to be(false)

      get "/api/v1/open/parts?low_stock=true", headers: headers
      expect(json_body["data"].pluck("id")).to eq([low.id])
      get "/api/v1/open/parts?q=bol", headers: headers
      expect(json_body["data"].pluck("id")).to eq([fine.id])
    end
  end

  it "has no endpoint for people, settings, keys or anything else the web app has" do
    %w[users api_keys organization_settings webhooks directory_settings reports].each do |name|
      get "/api/v1/open/#{name}", headers: headers
      expect(response).to have_http_status(:not_found)
    end
  end
end
