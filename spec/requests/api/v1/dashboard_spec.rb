require "rails_helper"

RSpec.describe "GET /api/v1/dashboard", type: :request do
  let(:org)     { create(:organization) }
  let(:manager) { create(:user, :manager, organization: org) }
  let(:tech)    { create(:user, organization: org) }
  let(:req_user){ create(:user, :requester, organization: org) }

  describe "admin/manager view" do
    it "returns full dashboard metrics" do
      headers = auth_headers_for(manager)
      get "/api/v1/dashboard", headers: headers, as: :json

      expect(response).to have_http_status(:ok)
      body = response.parsed_body
      expect(body).to include("work_orders", "assets", "preventive_maintenance", "iot", "recent_activity")
    end
  end

  describe "technician view" do
    it "returns personal dashboard" do
      headers = auth_headers_for(tech)
      get "/api/v1/dashboard", headers: headers, as: :json

      expect(response).to have_http_status(:ok)
      body = response.parsed_body
      expect(body).to include("my_work_orders", "upcoming_pms", "recent_activity")
    end
  end

  describe "requester view" do
    it "returns limited dashboard" do
      headers = auth_headers_for(req_user)
      get "/api/v1/dashboard", headers: headers, as: :json

      expect(response).to have_http_status(:ok)
      body = response.parsed_body
      expect(body).to include("my_requests")
    end
  end

  it "requires authentication" do
    get "/api/v1/dashboard", as: :json
    expect(response).to have_http_status(:unauthorized)
  end
end
