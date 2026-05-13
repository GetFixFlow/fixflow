require "rails_helper"

RSpec.describe "Multi-tenancy isolation", type: :request do
  let(:org_a)    { create(:organization) }
  let(:org_b)    { create(:organization) }
  let(:manager_a) { create(:user, :manager, organization: org_a) }
  let(:manager_b) { create(:user, :manager, organization: org_b) }

  let!(:wo_a)    { ActsAsTenant.with_tenant(org_a) { create(:work_order, organization: org_a) } }
  let!(:wo_b)    { ActsAsTenant.with_tenant(org_b) { create(:work_order, organization: org_b) } }
  let!(:asset_a) { ActsAsTenant.with_tenant(org_a) { create(:asset, organization: org_a) } }

  describe "work orders" do
    it "manager A cannot see org B work orders" do
      get "/api/v1/work_orders", headers: auth_headers_for(manager_a), as: :json

      expect(response).to have_http_status(:ok)
      ids = response.parsed_body["work_orders"].map { |w| w["id"] }
      expect(ids).to     include(wo_a.id)
      expect(ids).not_to include(wo_b.id)
    end

    it "manager A cannot access org B work order by ID" do
      get "/api/v1/work_orders/#{wo_b.id}", headers: auth_headers_for(manager_a), as: :json
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "assets" do
    it "manager A cannot see org B assets" do
      asset_b = ActsAsTenant.with_tenant(org_b) { create(:asset, organization: org_b) }

      get "/api/v1/assets", headers: auth_headers_for(manager_a), as: :json

      ids = response.parsed_body["assets"].map { |a| a["id"] }
      expect(ids).to     include(asset_a.id)
      expect(ids).not_to include(asset_b.id)
    end

    it "manager A cannot create asset in org B by injecting organization_id" do
      post "/api/v1/assets",
        params:  { asset: { name: "Injected", organization_id: org_b.id, status: "operational" } },
        headers: auth_headers_for(manager_a), as: :json

      # Should succeed but asset is created under org_a (tenant from JWT)
      if response.status == 201
        new_id = response.parsed_body.dig("data", "id") || response.parsed_body["id"]
        ActsAsTenant.without_tenant do
          expect(Asset.find(new_id).organization_id).to eq(org_a.id)
        end
      else
        expect(response).to have_http_status(:unprocessable_entity).or have_http_status(:bad_request)
      end
    end
  end

  describe "IoT ingestion" do
    it "API key from org A cannot ingest readings for org B assets" do
      asset_b = ActsAsTenant.with_tenant(org_b) { create(:asset, organization: org_b) }
      raw_key, digest = ApiKey.generate
      ActsAsTenant.with_tenant(org_a) { ApiKey.create!(name: "Test", key_digest: digest, organization: org_a) }

      post "/api/v1/iot/ingest",
        params: { asset_id: asset_b.id, metric_name: "temp", value: 72.0, timestamp: Time.current.iso8601 }.to_json,
        headers: { "Content-Type" => "application/json", "X-API-Key" => raw_key }

      expect(response).to have_http_status(:unprocessable_entity)
    end
  end
end
