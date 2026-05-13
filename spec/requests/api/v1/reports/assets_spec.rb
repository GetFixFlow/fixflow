require "rails_helper"

RSpec.describe "Asset Reports", type: :request do
  let(:org)     { create(:organization) }
  let(:manager) { create(:user, :manager, organization: org) }
  let(:asset)   { create(:asset, organization: org) }
  let(:headers) { auth_headers_for(manager) }

  describe "GET /api/v1/reports/assets/health" do
    it "returns asset health overview" do
      get "/api/v1/reports/assets/health", headers: headers, as: :json

      expect(response).to have_http_status(:ok)
      body = response.parsed_body
      expect(body).to include("health_score", "total", "by_status", "by_location",
                              "recently_degraded", "most_maintained")
    end

    it "returns CSV when requested" do
      get "/api/v1/reports/assets/health.csv", headers: headers

      expect(response).to have_http_status(:ok)
      expect(response.content_type).to include("text/csv")
    end
  end

  describe "GET /api/v1/reports/assets/:id/history" do
    it "returns asset timeline" do
      get "/api/v1/reports/assets/#{asset.id}/history", headers: headers, as: :json

      expect(response).to have_http_status(:ok)
      body = response.parsed_body
      expect(body).to include("asset", "summary", "timeline")
      expect(body["asset"]["id"]).to eq(asset.id)
    end

    it "returns 404 for asset not in org" do
      other_asset = create(:asset)
      get "/api/v1/reports/assets/#{other_asset.id}/history", headers: headers, as: :json
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "GET /api/v1/reports/assets/cost_analysis" do
    before do
      create(:work_order, :completed,
             organization: org, asset: asset,
             labor_cost: 100.0, parts_cost: 50.0)
    end

    it "returns cost breakdown by asset" do
      get "/api/v1/reports/assets/cost_analysis",
        params: { from: 30.days.ago.iso8601, to: Time.current.iso8601 },
        headers: headers, as: :json

      expect(response).to have_http_status(:ok)
      body = response.parsed_body
      expect(body).to include("total_cost", "total_labor_cost", "total_parts_cost", "by_asset")
    end
  end
end
