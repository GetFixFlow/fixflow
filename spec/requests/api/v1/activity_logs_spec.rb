require "rails_helper"

RSpec.describe "GET /api/v1/activity_logs", type: :request do
  let(:org)     { create(:organization) }
  let(:manager) { create(:user, :manager, organization: org) }
  let(:tech)    { create(:user, organization: org) }

  before do
    create(:activity_log, organization: org, user: manager,
           action: "work_order.completed", resource_type: "WorkOrder", resource_id: 1)
    create(:activity_log, organization: org, user: tech,
           action: "asset.updated", resource_type: "Asset", resource_id: 2)
  end

  describe "as manager" do
    let(:headers) { auth_headers_for(manager) }

    it "returns paginated activity logs" do
      get "/api/v1/activity_logs", headers: headers, as: :json

      expect(response).to have_http_status(:ok)
      body = response.parsed_body
      expect(body).to have_key("activity_logs")
      expect(body["activity_logs"].size).to eq(2)
    end

    it "filters by resource_type" do
      get "/api/v1/activity_logs",
        params: { resource_type: "WorkOrder" },
        headers: headers, as: :json

      expect(response.parsed_body["activity_logs"].size).to eq(1)
    end

    it "filters by action" do
      get "/api/v1/activity_logs",
        params: { action: "work_order.completed" },
        headers: headers, as: :json

      expect(response.parsed_body["activity_logs"].size).to eq(1)
    end

    it "filters by user_id" do
      get "/api/v1/activity_logs",
        params: { user_id: tech.id },
        headers: headers, as: :json

      expect(response.parsed_body["activity_logs"].size).to eq(1)
    end

    it "does not return logs from another org" do
      create(:activity_log, action: "work_order.created")
      get "/api/v1/activity_logs", headers: headers, as: :json
      expect(response.parsed_body["activity_logs"].size).to eq(2)
    end
  end

  describe "as technician" do
    it "is forbidden" do
      get "/api/v1/activity_logs", headers: auth_headers_for(tech), as: :json
      expect(response).to have_http_status(:forbidden)
    end
  end
end
