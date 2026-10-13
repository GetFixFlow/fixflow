require "rails_helper"

RSpec.describe "Api::V1::WorkOrderParts", type: :request do
  let(:org)        { create(:organization) }
  let!(:manager)   { create(:user, :manager, organization: org) }
  let!(:assignee)  { create(:user, organization: org) }
  let(:other_tech) { create(:user, organization: org) }
  let(:requester)  { create(:user, :requester, organization: org) }
  let(:work_order) { create(:work_order, :in_progress, organization: org, assignee: assignee) }
  let(:filter)     { create(:part, organization: org, name: "Oil filter", sku: "OF-1", quantity_on_hand: 5, unit_cost: 12.5) }
  let(:path)       { "/api/v1/work_orders/#{work_order.id}/parts" }

  def log(as_user: assignee, **attrs)
    post path, params: { part: attrs }, headers: auth_headers_for(as_user), as: :json
  end

  describe "GET /api/v1/work_orders/:id/parts" do
    it "lists the parts used, with names and SKUs" do
      create(:work_order_part, work_order: work_order, part: filter, quantity_used: 2, unit_cost: 11)

      get path, headers: auth_headers_for(assignee)

      expect(response).to have_http_status(:ok)
      expect(json_body["parts"]).to contain_exactly(
        hash_including("part_id" => filter.id, "name" => "Oil filter", "sku" => "OF-1", "quantity_used" => 2)
      )
    end

    it "requires authentication" do
      get path
      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "POST /api/v1/work_orders/:id/parts" do
    it "takes the parts out of stock and adds their cost to the work order" do
      log(part_id: filter.id, quantity_used: 3, unit_cost: 10)

      expect(response).to have_http_status(:created)
      expect(json_body["data"]).to include("name" => "Oil filter", "quantity_used" => 3)
      expect(filter.reload.quantity_on_hand).to eq(2)
      expect(work_order.reload.parts_cost).to eq(30)
    end

    it "uses the catalog's unit cost when none is given" do
      log(part_id: filter.id, quantity_used: 2)

      expect(work_order.reload.parts_cost).to eq(25)
    end

    it "adds up several parts" do
      belt = create(:part, organization: org, quantity_on_hand: 4, unit_cost: 30)
      log(part_id: filter.id, quantity_used: 2)
      log(part_id: belt.id, quantity_used: 1)

      expect(work_order.reload.parts_cost).to eq(55)
    end

    it "refuses more than is in stock, with the amount left, and changes nothing" do
      log(part_id: filter.id, quantity_used: 9)

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body.dig("error", "code")).to eq("INSUFFICIENT_STOCK")
      expect(json_body.dig("error", "message")).to include("Only 5.0 each of Oil filter in stock")
      expect(filter.reload.quantity_on_hand).to eq(5)
      expect(work_order.work_order_parts).to be_empty
      expect(work_order.reload.parts_cost).to eq(0)
    end

    it "cannot take the same stock twice" do
      log(part_id: filter.id, quantity_used: 3)
      log(part_id: filter.id, quantity_used: 3)

      expect(response).to have_http_status(:unprocessable_entity)
      expect(filter.reload.quantity_on_hand).to eq(2)
    end

    it "rejects a quantity of zero or less" do
      log(part_id: filter.id, quantity_used: 0)

      expect(response).to have_http_status(:unprocessable_entity)
      expect(filter.reload.quantity_on_hand).to eq(5)
    end

    it "does not accept a part from another company" do
      stranger = create(:part)
      log(part_id: stranger.id, quantity_used: 1)

      expect(response).to have_http_status(:not_found)
      expect(stranger.reload.quantity_on_hand).to eq(10)
    end

    it "lets a manager log parts on any work order" do
      log(part_id: filter.id, quantity_used: 1, as_user: manager)
      expect(response).to have_http_status(:created)
    end

    it "does not let another technician or a requester log parts" do
      [other_tech, requester].each do |person|
        log(part_id: filter.id, quantity_used: 1, as_user: person)
        expect(response).to have_http_status(:forbidden)
      end
      expect(filter.reload.quantity_on_hand).to eq(5)
    end

    it "does not change a verified or cancelled work order" do
      closed = create(:work_order, :cancelled, organization: org, assignee: assignee)
      post "/api/v1/work_orders/#{closed.id}/parts", params: { part: { part_id: filter.id, quantity_used: 1 } },
                                                     headers: auth_headers_for(manager), as: :json

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body.dig("error", "code")).to eq("WORK_ORDER_CLOSED")
      expect(filter.reload.quantity_on_hand).to eq(5)
    end
  end

  describe "DELETE /api/v1/work_orders/:id/parts/:id" do
    let!(:line) do
      log(part_id: filter.id, quantity_used: 3, unit_cost: 10)
      work_order.work_order_parts.last
    end

    it "puts the stock back and takes the cost off the work order" do
      delete "#{path}/#{line.id}", headers: auth_headers_for(assignee)

      expect(response).to have_http_status(:no_content)
      expect(filter.reload.quantity_on_hand).to eq(5)
      expect(work_order.reload.parts_cost).to eq(0)
    end

    it "is refused for someone who may not log parts" do
      delete "#{path}/#{line.id}", headers: auth_headers_for(requester)

      expect(response).to have_http_status(:forbidden)
      expect(filter.reload.quantity_on_hand).to eq(2)
    end
  end

  describe "the work order" do
    it "reports the parts used and what they cost" do
      log(part_id: filter.id, quantity_used: 2, unit_cost: 10)

      get "/api/v1/work_orders/#{work_order.id}", headers: auth_headers_for(assignee)

      expect(json_body["data"]["parts_used"]).to contain_exactly(hash_including("name" => "Oil filter", "quantity_used" => 2))
      expect(json_body["data"]["parts_cost"].to_f).to eq(20.0)
    end
  end
end
