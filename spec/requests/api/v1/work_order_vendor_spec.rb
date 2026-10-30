require "rails_helper"

RSpec.describe "Work orders given to a vendor", type: :request do
  let(:org)        { create(:organization) }
  let(:manager)    { create(:user, :manager, organization: org) }
  let(:technician) { create(:user, organization: org) }
  let(:vendor)     { create(:vendor, organization: org, name: "Acme Electric") }
  let(:asset)      { create(:asset, organization: org) }
  let(:work_order) { create(:work_order, :assigned, organization: org, asset: asset, assignee: technician) }

  describe "a manager gives a work order to a vendor" do
    it "sets the vendor, what they charged and their invoice number on a new work order" do
      post "/api/v1/work_orders", headers: auth_headers_for(manager),
        params: { work_order: { title: "Rewire panel", asset_id: asset.id, vendor_id: vendor.id,
                                vendor_cost: 1250.5, vendor_reference: "INV-77" } }

      expect(response).to have_http_status(:created)
      expect(WorkOrder.find(json_body["data"]["id"])).to have_attributes(vendor_id: vendor.id, vendor_cost: 1250.5,
vendor_reference: "INV-77")
      expect(json_body["data"]["vendor"]).to eq("id" => vendor.id, "name" => "Acme Electric")
    end

    it "changes them later, and takes the vendor off again" do
      patch "/api/v1/work_orders/#{work_order.id}", params: { work_order: { vendor_id: vendor.id, vendor_cost: 80 } },
        headers: auth_headers_for(manager)
      expect(work_order.reload).to have_attributes(vendor_id: vendor.id, vendor_cost: 80)

      patch "/api/v1/work_orders/#{work_order.id}", params: { work_order: { vendor_id: nil, vendor_cost: 0 } },
        headers: auth_headers_for(manager)
      expect(work_order.reload).to have_attributes(vendor_id: nil, vendor_cost: 0)
    end

    it "keeps the internal assignee: a vendor job can still have someone watching it" do
      patch "/api/v1/work_orders/#{work_order.id}", params: { work_order: { vendor_id: vendor.id } }, headers: auth_headers_for(manager)

      expect(work_order.reload).to have_attributes(vendor_id: vendor.id, assignee_id: technician.id)
    end

    it "refuses another company's vendor, a deactivated vendor and a negative charge" do
      patch "/api/v1/work_orders/#{work_order.id}", params: { work_order: { vendor_id: create(:vendor).id } },
headers: auth_headers_for(manager)
      expect(response).to have_http_status(:unprocessable_entity)

      off = create(:vendor, organization: org, active: false)
      patch "/api/v1/work_orders/#{work_order.id}", params: { work_order: { vendor_id: off.id } }, headers: auth_headers_for(manager)
      expect(response).to have_http_status(:unprocessable_entity)

      patch "/api/v1/work_orders/#{work_order.id}", params: { work_order: { vendor_cost: -5 } }, headers: auth_headers_for(manager)
      expect(response).to have_http_status(:unprocessable_entity)
      expect(work_order.reload.vendor_id).to be_nil
    end

    it "lets work that was already given to a vendor continue after the vendor is deactivated" do
      work_order.update!(vendor: vendor)
      vendor.update!(active: false)

      patch "/api/v1/work_orders/#{work_order.id}", params: { work_order: { vendor_cost: 99 } }, headers: auth_headers_for(manager)

      expect(response).to have_http_status(:ok)
      expect(work_order.reload.vendor_cost).to eq(99)
    end
  end

  describe "who may see and change it" do
    it "does not let a technician, even the assignee, set the vendor or the charge" do
      patch "/api/v1/work_orders/#{work_order.id}", params: { work_order: { vendor_id: vendor.id, vendor_cost: 5 } },
        headers: auth_headers_for(technician)

      expect(response).to have_http_status(:forbidden)
      expect(work_order.reload).to have_attributes(vendor_id: nil, vendor_cost: 0)

      post "/api/v1/work_orders", params: { work_order: { title: "X", vendor_cost: 5 } }, headers: auth_headers_for(technician)
      expect(response).to have_http_status(:forbidden)
    end

    it "still lets the technician edit the rest of their work order" do
      patch "/api/v1/work_orders/#{work_order.id}", params: { work_order: { description: "Found a loose wire" } },
        headers: auth_headers_for(technician)

      expect(response).to have_http_status(:ok)
    end

    it "shows the vendor's name to the technician but what the vendor charged only to a manager" do
      work_order.update!(vendor: vendor, vendor_cost: 300, vendor_reference: "INV-1")

      get "/api/v1/work_orders/#{work_order.id}", headers: auth_headers_for(technician)
      expect(json_body["data"]["vendor"]).to include("name" => "Acme Electric")
      expect(json_body["data"]).to include("vendor_cost" => nil, "vendor_reference" => nil)

      get "/api/v1/work_orders/#{work_order.id}", headers: auth_headers_for(manager)
      expect(json_body["data"]).to include("vendor_cost" => "300.0", "vendor_reference" => "INV-1")
    end
  end

  describe "listing" do
    it "filters work orders by vendor" do
      done = create(:work_order, organization: org, vendor: vendor)
      create(:work_order, organization: org)

      get "/api/v1/work_orders", params: { vendor_id: vendor.id }, headers: auth_headers_for(manager)

      expect(json_body["work_orders"].pluck("id")).to eq([done.id])
    end
  end

  it "records the change in the audit log without the amounts" do
    patch "/api/v1/work_orders/#{work_order.id}", params: { work_order: { vendor_id: vendor.id, vendor_cost: 4321 } },
      headers: auth_headers_for(manager)

    line = ActivityLog.where(action: "work_order.updated", resource_id: work_order.id).order(:id).last
    expect(line.metadata["changed"]).to include("vendor_id", "vendor_cost")
    expect(line.metadata.to_s).not_to include("4321")
  end
end
