require "rails_helper"

# What is filled in for the company's custom fields, on work orders and on parts.
RSpec.describe "Custom field values", type: :request do
  let(:org)        { create(:organization) }
  let(:manager)    { create(:user, :manager, organization: org) }
  let(:technician) { create(:user, organization: org) }
  let(:requester)  { create(:user, :requester, organization: org) }
  let!(:centre)    { create(:custom_field, :required, organization: org, label: "Cost centre") }
  let(:asset)      { create(:asset, organization: org) }

  before do
    create(:custom_field, :number, organization: org, label: "Budget", in_list: true)
    create(:custom_field, :part, :required, organization: org, label: "Shelf")
  end

  def send_json(verb, url, body = nil, as: manager)
    public_send(verb, url, params: body&.to_json, headers: auth_headers_for(as).merge("Content-Type" => "application/json"))
  end

  def new_order(values, **extra)
    send_json :post, "/api/v1/work_orders", { work_order: { title: "Fix pump", asset_id: asset.id, custom_values: values, **extra } },
              as: technician
  end

  describe "creating a work order" do
    it "stores the values and shows them in the answer, the list and the work order" do
      new_order({ "cost_centre" => "CC-1", "budget" => "250" })

      expect(response).to have_http_status(:created)
      expect(json_body.dig("data", "custom_values")).to eq("cost_centre" => "CC-1", "budget" => 250)
      id = json_body.dig("data", "id")

      send_json :get, "/api/v1/work_orders/#{id}", as: requester
      expect(json_body.dig("data", "custom_values")).to eq("cost_centre" => "CC-1", "budget" => 250)

      send_json :get, "/api/v1/work_orders"
      expect(json_body["work_orders"].first["custom_values"]).to eq("cost_centre" => "CC-1", "budget" => 250)
    end

    it "asks for a required field, and makes no work order without it" do
      expect { new_order({ "budget" => 5 }) }.not_to(change { org.work_orders.count })

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body.dig("error", "message")).to eq("Cost centre is required")
    end

    it "asks for a required field when no values are sent at all" do
      send_json :post, "/api/v1/work_orders", { work_order: { title: "Fix pump", asset_id: asset.id } }, as: technician

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "is not held up by a field that is turned off" do
      centre.update!(active: false)
      new_order({})

      expect(response).to have_http_status(:created)
    end

    it "says which value is wrong" do
      new_order({ "cost_centre" => "CC-1", "budget" => "lots" })

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body.dig("error", "message")).to eq("Budget must be a number")
    end

    it "refuses a value for a field that does not exist" do
      new_order({ "cost_centre" => "CC-1", "colour" => "red" })

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "does not take nested values" do
      new_order({ "cost_centre" => { "a" => 1 } })

      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  describe "work that is made without a form" do
    it "is not refused for a required field: a request on the public page, a job" do
      expect(create(:work_order, organization: org)).to be_persisted
    end

    it "is not refused on the public request page" do
      payload = { requester_name: "Kamal Perera", requester_email: "k@example.com", description: "Leaking onto the floor",
                  asset_code: asset.public_code }
      post "/api/v1/work_requests", params: { work_request: payload }, as: :json

      expect(response).to have_http_status(:created)
    end
  end

  describe "editing a work order" do
    let!(:order) { create(:work_order, organization: org, asset: asset, custom_values: { "cost_centre" => "CC-1", "budget" => 10 }) }

    it "changes the values it is sent and leaves the others" do
      send_json :patch, "/api/v1/work_orders/#{order.id}", { work_order: { custom_values: { "budget" => "20" } } }

      expect(response).to have_http_status(:ok)
      expect(order.reload.custom_values).to eq("cost_centre" => "CC-1", "budget" => 20)
    end

    it "does not let a required field be emptied" do
      send_json :patch, "/api/v1/work_orders/#{order.id}", { work_order: { custom_values: { "cost_centre" => "" } } }

      expect(response).to have_http_status(:unprocessable_entity)
      expect(order.reload.custom_values["cost_centre"]).to eq("CC-1")
    end

    it "does not ask for a required field that an old work order never had, unless the values are being edited" do
      old = create(:work_order, organization: org, asset: asset)
      send_json :patch, "/api/v1/work_orders/#{old.id}", { work_order: { title: "New title" } }
      expect(response).to have_http_status(:ok)

      send_json :patch, "/api/v1/work_orders/#{old.id}", { work_order: { custom_values: { "budget" => 5 } } }
      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "leaves moving the work along alone: a required field added later does not stop a start" do
      old = create(:work_order, organization: org, asset: asset, assignee: technician, status: "assigned")
      send_json :patch, "/api/v1/work_orders/#{old.id}/start", as: technician

      expect(response).to have_http_status(:ok)
      expect(old.reload.status).to eq("in_progress")
    end

    it "records that values changed in the audit log, but never what they were" do
      send_json :patch, "/api/v1/work_orders/#{order.id}", { work_order: { custom_values: { "budget" => 987_654 } } }

      line = ActivityLog.where(action: "work_order.updated", resource_id: order.id).order(:id).last
      expect(line.metadata.to_s).to include("custom_values")
      expect(line.metadata.to_s).not_to include("987654")
    end
  end

  describe "parts" do
    it "stores values, shows them, and asks for the required ones" do
      send_json :post, "/api/v1/parts", { part: { name: "Belt", custom_values: { "shelf" => "A1" } } }

      expect(response).to have_http_status(:created)
      expect(json_body["custom_values"]).to eq("shelf" => "A1")

      send_json :post, "/api/v1/parts", { part: { name: "Bolt" } }
      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body.dig("error", "message")).to eq("Shelf is required")
    end

    it "uses the part's fields, not the work order's" do
      send_json :post, "/api/v1/parts", { part: { name: "Belt", custom_values: { "shelf" => "A1", "budget" => 5 } } }

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "changes only what it is sent, and adjusting the stock needs no values" do
      part = create(:part, organization: org, custom_values: { "shelf" => "A1" })
      send_json :patch, "/api/v1/parts/#{part.id}", { part: { name: "Belt 2" } }
      expect(response).to have_http_status(:ok)

      send_json :patch, "/api/v1/parts/#{part.id}", { part: { custom_values: { "shelf" => "B2" } } }
      expect(part.reload.custom_values).to eq("shelf" => "B2")

      send_json :patch, "/api/v1/parts/#{part.id}/adjust_stock", { quantity: 1, direction: "add" }
      expect(response).to have_http_status(:ok)
    end

    it "does not ask a part that never had a required field for it when something else is edited" do
      old = create(:part, organization: org)
      send_json :patch, "/api/v1/parts/#{old.id}", { part: { name: "Renamed" } }

      expect(response).to have_http_status(:ok)
      expect(old.reload.name).to eq("Renamed")
    end

    it "lists them with the values, and names the fields changed in the audit log, not the values" do
      part = create(:part, organization: org, custom_values: { "shelf" => "A1" })
      send_json :patch, "/api/v1/parts/#{part.id}", { part: { custom_values: { "shelf" => "Secret-9" } } }
      send_json :get, "/api/v1/parts", as: technician

      expect(json_body["parts"].first["custom_values"]).to eq("shelf" => "Secret-9")
      line = ActivityLog.where(action: "part.updated", resource_id: part.id).last
      expect(line.metadata.to_s).to include("shelf")
      expect(line.metadata.to_s).not_to include("Secret-9")
    end
  end

  describe "the export of work orders" do
    def csv = CSV.parse(response.body.delete_prefix("﻿"), headers: true)

    before do
      hidden = create(:custom_field, organization: org, label: "Hidden")
      create(:custom_field, organization: org, label: "Status")
      create(:custom_field, :checkbox, organization: org, label: "Safe to touch")
      create(:work_order, organization: org, asset: asset, title: "Pump leaking", created_at: 1.day.ago,
                          custom_values: { "cost_centre" => "CC-1", "budget" => 5, "hidden" => "x", "safe_to_touch" => false,
                                           "status" => "mine" })
      create(:work_order, organization: org, asset: asset, title: "Plain job", created_at: 1.day.ago)
      hidden.update!(active: false)
    end

    it "has a column for each field that is on, headed by its label, after the usual ones" do
      get "/api/v1/reports/work_orders/summary.csv", params: { from: 5.days.ago.to_date.iso8601, to: Time.current.to_date.iso8601 },
                                                     headers: auth_headers_for(manager)

      expect(csv.headers.last(4)).to eq(["Cost centre", "Budget", "Status (custom)", "Safe to touch"])
      expect(csv.headers).not_to include("Hidden")
      expect(csv.find { |row| row["title"] == "Pump leaking" }.to_h)
        .to include("Cost centre" => "CC-1", "Budget" => "5", "Status (custom)" => "mine", "Safe to touch" => "No", "status" => "open")
      expect(csv.find { |row| row["title"] == "Plain job" }.to_h).to include("Cost centre" => "", "Budget" => "", "Safe to touch" => "")
    end

    it "keeps text that a spreadsheet would run as a formula from running" do
      create(:work_order, organization: org, asset: asset, title: "Formula", created_at: 1.day.ago,
                          custom_values: { "cost_centre" => "=1+1" })
      get "/api/v1/reports/work_orders/summary.csv", params: { from: 5.days.ago.to_date.iso8601, to: Time.current.to_date.iso8601 },
                                                     headers: auth_headers_for(manager)

      expect(csv.find { |row| row["title"] == "Formula" }["Cost centre"]).to eq("'=1+1")
    end
  end
end
