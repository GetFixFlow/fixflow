require "rails_helper"

RSpec.describe "Work Order Reports", type: :request do
  let(:org)     { create(:organization) }
  let(:manager) { create(:user, :manager, organization: org) }
  let(:tech)    { create(:user, organization: org) }
  let(:asset)   { create(:asset, organization: org) }
  let(:headers) { auth_headers_for(manager) }

  before do
    create(:work_order, organization: org, asset: asset, status: "completed", completion_notes: "Replaced seal",
           completed_at: 1.day.ago, started_at: 2.days.ago, assignee: tech)
    create(:work_order, organization: org, asset: asset, status: "open")
  end

  describe "GET /api/v1/reports/work_orders/summary" do
    it "returns summary metrics" do
      get "/api/v1/reports/work_orders/summary",
        params: { from: 30.days.ago.iso8601, to: Time.current.iso8601 },
        headers: headers

      expect(response).to have_http_status(:ok)
      body = response.parsed_body
      expect(body).to include("totals", "by_priority", "by_status", "trend")
    end

    it "accepts CSV format" do
      get "/api/v1/reports/work_orders/summary.csv",
        params: { from: 30.days.ago.iso8601, to: Time.current.iso8601 },
        headers: headers

      expect(response).to have_http_status(:ok)
      expect(response.content_type).to include("text/csv")
    end
  end

  describe "GET /api/v1/reports/work_orders/mttr" do
    it "returns MTTR breakdown" do
      get "/api/v1/reports/work_orders/mttr",
        params: { from: 30.days.ago.iso8601, to: Time.current.iso8601 },
        headers: headers

      expect(response).to have_http_status(:ok)
      body = response.parsed_body
      expect(body).to include("overall_avg", "by_group")
      expect(body["by_group"].keys).to eq(%w[asset location technician])
    end
  end

  describe "GET /api/v1/reports/work_orders/backlog" do
    it "returns open WO aging buckets" do
      get "/api/v1/reports/work_orders/backlog", headers: headers

      expect(response).to have_http_status(:ok)
      body = response.parsed_body
      expect(body).to include("total_open", "aging", "oldest_wos")
      expect(body["aging"].first).to include("bucket" => "0-7 days")
    end
  end

  describe "GET /api/v1/reports/work_orders/technician_performance" do
    it "is accessible to managers" do
      get "/api/v1/reports/work_orders/technician_performance",
        params: { from: 30.days.ago.iso8601, to: Time.current.iso8601 },
        headers: headers

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body).to include("technicians")
    end

    it "is forbidden to technicians" do
      get "/api/v1/reports/work_orders/technician_performance",
        params: { from: 30.days.ago.iso8601, to: Time.current.iso8601 },
        headers: auth_headers_for(tech)

      expect(response).to have_http_status(:forbidden)
    end
  end
end
