require "rails_helper"

RSpec.describe "Api::V1::Parts", type: :request do
  let(:org)        { create(:organization) }
  let(:admin)      { create(:user, :admin, organization: org) }
  let(:manager)    { create(:user, :manager, organization: org) }
  let(:technician) { create(:user, organization: org) }
  let(:requester)  { create(:user, :requester, organization: org) }
  let!(:filter)    { create(:part, organization: org, name: "Oil filter", sku: "OF-100", quantity_on_hand: 5, reorder_point: 5) }
  let!(:belt)      { create(:part, organization: org, name: "V-belt", sku: "VB-7", quantity_on_hand: 20, reorder_point: 4) }

  describe "GET /api/v1/parts" do
    it "lets a technician see the catalog, with numbers as numbers" do
      get "/api/v1/parts", headers: auth_headers_for(technician)

      expect(response).to have_http_status(:ok)
      row = json_body["parts"].find { |p| p["name"] == "Oil filter" }
      expect(row).to include("sku" => "OF-100", "quantity_on_hand" => 5.0, "unit_cost" => 12.5, "low_stock" => true)
    end

    it "searches by name or SKU, ignoring case" do
      get "/api/v1/parts", params: { search: "belt" }, headers: auth_headers_for(technician)
      expect(json_body["parts"].pluck("name")).to eq(["V-belt"])

      get "/api/v1/parts", params: { search: "of-1" }, headers: auth_headers_for(technician)
      expect(json_body["parts"].pluck("name")).to eq(["Oil filter"])
    end

    it "treats the search as text, not a pattern" do
      get "/api/v1/parts", params: { search: "%" }, headers: auth_headers_for(technician)
      expect(json_body["parts"]).to be_empty
    end

    it "only shows the company's own parts" do
      create(:part, name: "Someone else's part")

      get "/api/v1/parts", headers: auth_headers_for(technician)

      expect(json_body["parts"].pluck("name")).to contain_exactly("Oil filter", "V-belt")
    end

    it "is not for requesters" do
      get "/api/v1/parts", headers: auth_headers_for(requester)
      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "changing the catalog" do
    let(:new_part) { { part: { name: "Bearing", sku: "BR-1", quantity_on_hand: 8, reorder_point: 2, unit_cost: 45 } } }

    it "lets a manager add and edit parts" do
      post "/api/v1/parts", params: new_part, headers: auth_headers_for(manager), as: :json
      expect(response).to have_http_status(:created)
      expect(json_body["unit_cost"]).to eq(45.0)

      patch "/api/v1/parts/#{json_body['id']}", params: { part: { unit_cost: 50 } }, headers: auth_headers_for(manager), as: :json
      expect(json_body["unit_cost"]).to eq(50.0)
    end

    it "does not let a technician or requester add, edit or delete parts" do
      [technician, requester].each do |person|
        post "/api/v1/parts", params: new_part, headers: auth_headers_for(person), as: :json
        expect(response).to have_http_status(:forbidden)
        patch "/api/v1/parts/#{filter.id}", params: { part: { name: "Hijacked" } }, headers: auth_headers_for(person), as: :json
        expect(response).to have_http_status(:forbidden)
        delete "/api/v1/parts/#{filter.id}", headers: auth_headers_for(person), as: :json
        expect(response).to have_http_status(:forbidden)
      end
      expect(filter.reload.name).to eq("Oil filter")
    end

    it "does not let the stock level be edited directly, only adjusted" do
      patch "/api/v1/parts/#{belt.id}", params: { part: { quantity_on_hand: 999, name: "V-belt B" } },
headers: auth_headers_for(manager), as: :json

      expect(response).to have_http_status(:ok)
      expect(belt.reload).to have_attributes(name: "V-belt B", quantity_on_hand: 20)
    end

    it "refuses a SKU already used in the company, ignoring case, but allows several parts without one" do
      post "/api/v1/parts", params: { part: { name: "Another filter", sku: "of-100" } }, headers: auth_headers_for(manager), as: :json
      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body.dig("error", "message")).to eq("Sku is already used by another part")

      2.times do |i|
        post "/api/v1/parts", params: { part: { name: "No SKU #{i}", sku: "  " } }, headers: auth_headers_for(manager), as: :json
        expect(response).to have_http_status(:created)
      end
    end

    it "allows the same SKU in another company" do
      other = create(:organization)
      expect(build(:part, organization: other, sku: "OF-100")).to be_valid
    end

    it "refuses a negative cost" do
      post "/api/v1/parts", params: { part: { name: "Bad", unit_cost: -1 } }, headers: auth_headers_for(manager), as: :json
      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "keeps a record of who changed the catalog" do
      expect do
        post "/api/v1/parts", params: new_part, headers: auth_headers_for(manager), as: :json
        patch "/api/v1/parts/#{json_body['id']}", params: { part: { unit_cost: 50 } }, headers: auth_headers_for(manager), as: :json
      end.to change { ActivityLog.where(action: %w[part.created part.updated]).count }.by(2)
    end

    it "refuses to delete a part that has been used on a work order" do
      work_order = create(:work_order, organization: org)
      create(:work_order_part, work_order: work_order, part: belt, quantity_used: 1)

      delete "/api/v1/parts/#{belt.id}", headers: auth_headers_for(admin), as: :json

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body.dig("error", "code")).to eq("PART_IN_USE")
      expect(Part.exists?(belt.id)).to be(true)
      expect(work_order.work_order_parts.count).to eq(1)
    end

    it "lets only an admin delete a part" do
      delete "/api/v1/parts/#{belt.id}", headers: auth_headers_for(manager), as: :json
      expect(response).to have_http_status(:forbidden)

      delete "/api/v1/parts/#{belt.id}", headers: auth_headers_for(admin), as: :json
      expect(response).to have_http_status(:no_content)
    end
  end

  describe "PATCH /api/v1/parts/:id/adjust_stock" do
    it "adds and removes stock" do
      patch "/api/v1/parts/#{belt.id}/adjust_stock", params: { quantity: 5, direction: "add" }, headers: auth_headers_for(technician),
as: :json
      expect(json_body["quantity_on_hand"]).to eq(25.0)

      patch "/api/v1/parts/#{belt.id}/adjust_stock", params: { quantity: 10, direction: "remove" },
headers: auth_headers_for(technician), as: :json
      expect(json_body["quantity_on_hand"]).to eq(15.0)
    end

    it "records who changed the stock, from what to what, and why" do
      patch "/api/v1/parts/#{belt.id}/adjust_stock", params: { quantity: 3, direction: "remove", reason: "Cycle count" },
headers: auth_headers_for(technician), as: :json

      log = ActivityLog.where(action: "part.stock_adjusted").last
      expect(log.user_id).to eq(technician.id)
      expect(log.metadata).to include("from" => 20.0, "to" => 17.0, "reason" => "Cycle count")
    end

    it "refuses a zero or missing quantity" do
      patch "/api/v1/parts/#{belt.id}/adjust_stock", params: { quantity: 0 }, headers: auth_headers_for(technician), as: :json
      expect(response).to have_http_status(:unprocessable_entity)
      expect(belt.reload.quantity_on_hand).to eq(20)
    end

    it "refuses to go below zero with a clear message" do
      patch "/api/v1/parts/#{filter.id}/adjust_stock", params: { quantity: 9, direction: "remove" },
headers: auth_headers_for(technician), as: :json

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body.dig("error", "message")).to include("Only 5.0 each of Oil filter in stock")
      expect(filter.reload.quantity_on_hand).to eq(5)
    end

    it "is not for requesters" do
      patch "/api/v1/parts/#{belt.id}/adjust_stock", params: { quantity: 1 }, headers: auth_headers_for(requester), as: :json
      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "GET /api/v1/parts?low_stock=true" do
    it "lets a technician see just the parts to reorder" do
      get "/api/v1/parts", params: { low_stock: "true" }, headers: auth_headers_for(technician)

      expect(json_body["parts"].pluck("name")).to eq(["Oil filter"])
    end
  end

  describe "GET /api/v1/parts/low_stock" do
    it "lists what is at or under its reorder point, for managers" do
      get "/api/v1/parts/low_stock", headers: auth_headers_for(manager)
      expect(json_body["parts"].pluck("name")).to eq(["Oil filter"])

      get "/api/v1/parts/low_stock", headers: auth_headers_for(technician)
      expect(response).to have_http_status(:forbidden)
    end
  end
end
