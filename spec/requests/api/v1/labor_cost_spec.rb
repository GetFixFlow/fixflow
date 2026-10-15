require "rails_helper"

RSpec.describe "Labor cost", type: :request do
  let(:org)        { create(:organization) }
  let(:admin)      { create(:user, :admin, organization: org) }
  let(:manager)    { create(:user, :manager, organization: org) }
  let(:technician) { create(:user, organization: org, hourly_rate: 45) }
  let(:requester)  { create(:user, :requester, organization: org) }
  let(:work_order) { create(:work_order, :in_progress, organization: org, assignee: technician, completion_notes: nil) }

  def complete(hours)
    patch "/api/v1/work_orders/#{work_order.id}/transition",
          params: { event: "complete", work_order: { completion_notes: "Replaced the belt and tested", actual_hours: hours } },
          headers: auth_headers_for(technician), as: :json
  end

  describe "completing a work order" do
    it "prices the hours at the technician's rate" do
      complete(2)

      expect(response).to have_http_status(:ok)
      expect(work_order.reload).to have_attributes(actual_hours: 2, labor_rate: 45, labor_cost: 90)
    end

    it "shows managers and administrators the labor cost and the rate it used" do
      complete(2)

      [manager, admin].each do |person|
        get "/api/v1/work_orders/#{work_order.id}", headers: auth_headers_for(person)
        expect(json_body["data"]).to include("labor_cost" => "90.0", "labor_rate" => "45.0", "actual_hours" => "2.0")
      end
    end

    it "keeps what people are paid from technicians and requesters, in every response" do
      complete(2)
      expect(json_body.dig("data", "labor_cost")).to be_nil # the technician's own transition response

      [technician, requester].each do |person|
        get "/api/v1/work_orders/#{work_order.id}", headers: auth_headers_for(person)
        expect(json_body["data"]).to include("labor_cost" => nil, "labor_rate" => nil)
        expect(response.body).not_to include("90.0")
      end
    end
  end

  describe "the cost report" do
    it "now includes the labor" do
      work_order.update!(asset: create(:asset, organization: org), parts_cost: 10)
      complete(2)

      get "/api/v1/reports/assets/cost_analysis", params: { from: 30.days.ago.iso8601, to: 1.day.from_now.iso8601 },
headers: auth_headers_for(manager)

      expect(json_body).to include("total_labor_cost" => 90.0, "total_parts_cost" => 10.0, "total_cost" => 100.0)
    end
  end

  describe "the company's default rate" do
    it "is saved with the company settings, and survives a reload" do
      patch "/api/v1/organization_settings", params: { organization: { labor_rate: "37.5" } }, headers: auth_headers_for(admin),
as: :json

      expect(response).to have_http_status(:ok)
      get "/api/v1/organization_settings", headers: auth_headers_for(admin)
      expect(json_body.dig("organization", "labor_rate")).to eq(37.5)
    end

    it "is used for people with no rate of their own" do
      patch "/api/v1/organization_settings", params: { organization: { labor_rate: 30 } }, headers: auth_headers_for(admin), as: :json
      technician.update!(hourly_rate: nil)

      complete(2)

      expect(work_order.reload.labor_cost).to eq(60)
    end

    [-1, "lots", 100_001].each do |bad|
      it "refuses #{bad.inspect}" do
        patch "/api/v1/organization_settings", params: { organization: { labor_rate: bad } }, headers: auth_headers_for(admin),
as: :json

        expect(response).to have_http_status(:unprocessable_entity)
        expect(org.reload.default_labor_rate).to eq(0)
      end
    end
  end

  describe "a person's own rate" do
    it "is set by an administrator, and shown to administrators only" do
      patch "/api/v1/users/#{technician.id}", params: { user: { hourly_rate: 52.5 } }, headers: auth_headers_for(admin), as: :json
      expect(json_body["hourly_rate"]).to eq(52.5)

      get "/api/v1/users", headers: auth_headers_for(admin)
      expect(json_body["users"].find { |u| u["id"] == technician.id }["hourly_rate"]).to eq(52.5)

      get "/api/v1/users", headers: auth_headers_for(manager)
      expect(json_body["users"].pluck("hourly_rate").compact).to be_empty
    end

    it "cannot be set by a manager" do
      patch "/api/v1/users/#{technician.id}", params: { user: { hourly_rate: 1, job_title: "Fitter" } },
headers: auth_headers_for(manager), as: :json

      expect(technician.reload).to have_attributes(hourly_rate: 45, job_title: "Fitter")
    end

    it "can be cleared, falling back to the company's rate" do
      patch "/api/v1/users/#{technician.id}", params: { user: { hourly_rate: nil } }, headers: auth_headers_for(admin), as: :json

      expect(technician.reload.hourly_rate).to be_nil
    end

    it "refuses a negative rate" do
      patch "/api/v1/users/#{technician.id}", params: { user: { hourly_rate: -5 } }, headers: auth_headers_for(admin), as: :json

      expect(response).to have_http_status(:unprocessable_entity)
      expect(technician.reload.hourly_rate).to eq(45)
    end
  end
end
