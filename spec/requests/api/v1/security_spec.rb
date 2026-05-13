require "rails_helper"

RSpec.describe "API Security", type: :request do
  let(:org)     { create(:organization) }
  let(:manager) { create(:user, :manager, organization: org) }

  describe "authentication" do
    it "returns 401 without a token" do
      get "/api/v1/assets", as: :json
      expect(response).to have_http_status(:unauthorized)
    end

    it "returns 401 with an invalid token" do
      get "/api/v1/assets",
        headers: { "Authorization" => "Bearer invalid.token.here" }, as: :json
      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "X-Request-ID header" do
    it "echoes a provided X-Request-ID" do
      custom_id = "my-trace-id-123"
      headers = auth_headers_for(manager).merge("X-Request-ID" => custom_id)
      get "/api/v1/assets", headers: headers, as: :json
      expect(response.headers["X-Request-ID"]).to eq(custom_id)
    end

    it "generates a UUID when X-Request-ID is not provided" do
      get "/api/v1/health"
      expect(response.headers["X-Request-ID"]).to match(/\A[0-9a-f-]{36}\z/)
    end
  end

  describe "error response format" do
    it "returns standardized 404 JSON" do
      headers = auth_headers_for(manager)
      get "/api/v1/assets/999999", headers: headers, as: :json

      expect(response).to have_http_status(:not_found)
      body = response.parsed_body
      expect(body["success"]).to be false
      expect(body["error"]).to include("code" => "RESOURCE_NOT_FOUND")
      expect(body["meta"]).to include("request_id", "timestamp")
    end
  end

  describe "cross-organization isolation" do
    let(:other_org)  { create(:organization) }
    let(:other_user) { create(:user, :manager, organization: other_org) }
    let!(:asset)     { ActsAsTenant.with_tenant(org) { create(:asset, organization: org) } }

    it "returns 404 (not 403) when accessing another org's asset" do
      headers = auth_headers_for(other_user)
      get "/api/v1/assets/#{asset.id}", headers: headers, as: :json
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "SQL injection protection" do
    it "handles injection attempt in search param without error" do
      headers = auth_headers_for(manager)
      get "/api/v1/assets", params: { q: "'; DROP TABLE assets; --" },
          headers: headers, as: :json
      expect(response).not_to have_http_status(:internal_server_error)
    end
  end
end
