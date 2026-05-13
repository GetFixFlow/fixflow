require "rails_helper"

RSpec.describe "IoT Rules API", type: :request do
  let(:org)     { create(:organization) }
  let(:admin)   { create(:user, :admin,   organization: org) }
  let(:manager) { create(:user, :manager, organization: org) }
  let(:tech)    { create(:user,           organization: org) }  # technician
  let(:asset)   { create(:asset, organization: org) }

  let(:admin_headers)   { auth_headers_for(admin) }
  let(:manager_headers) { auth_headers_for(manager) }
  let(:tech_headers)    { auth_headers_for(tech) }

  let!(:rule) { create(:iot_rule, asset: asset, organization: org, created_by: admin) }

  # ── GET /api/v1/iot_rules ─────────────────────────────────────────────────

  describe "GET /api/v1/iot_rules" do
    it "returns active rules" do
      get "/api/v1/iot_rules", headers: admin_headers
      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body["iot_rules"].size).to be >= 1
    end

    it "filters by asset_id" do
      other_asset = create(:asset, organization: org)
      other_rule  = create(:iot_rule, asset: other_asset, organization: org)
      get "/api/v1/iot_rules?asset_id=#{asset.id}", headers: admin_headers
      body = JSON.parse(response.body)
      ids = body["iot_rules"].map { |r| r["id"] }
      expect(ids).to include(rule.id)
      expect(ids).not_to include(other_rule.id)
    end

    it "filters by status" do
      paused_rule = create(:iot_rule, :paused, asset: asset, organization: org)
      get "/api/v1/iot_rules?status=paused", headers: admin_headers
      body = JSON.parse(response.body)
      ids = body["iot_rules"].map { |r| r["id"] }
      expect(ids).to include(paused_rule.id)
      expect(ids).not_to include(rule.id)
    end
  end

  # ── POST /api/v1/iot_rules ────────────────────────────────────────────────

  describe "POST /api/v1/iot_rules" do
    let(:valid_params) do
      {
        iot_rule: {
          name: "High Temp Alert", asset_id: asset.id, metric_name: "temperature",
          operator: "gt", threshold: 90.0, unit: "celsius",
          wo_priority: "high", auto_create_wo: true, cooldown_minutes: 60
        }
      }
    end

    it "allows admin to create a rule" do
      expect {
        post "/api/v1/iot_rules", params: valid_params.to_json,
          headers: admin_headers.merge("Content-Type" => "application/json")
      }.to change(IotRule, :count).by(1)
      expect(response).to have_http_status(:created)
    end

    it "allows manager to create a rule" do
      post "/api/v1/iot_rules", params: valid_params.to_json,
        headers: manager_headers.merge("Content-Type" => "application/json")
      expect(response).to have_http_status(:created)
    end

    it "forbids technician from creating a rule" do
      post "/api/v1/iot_rules", params: valid_params.to_json,
        headers: tech_headers.merge("Content-Type" => "application/json")
      expect(response).to have_http_status(:forbidden)
    end
  end

  # ── PATCH /api/v1/iot_rules/:id/pause and /resume ────────────────────────

  describe "PATCH /api/v1/iot_rules/:id/pause" do
    it "pauses the rule" do
      patch "/api/v1/iot_rules/#{rule.id}/pause", headers: admin_headers
      expect(response).to have_http_status(:ok)
      expect(rule.reload.status).to eq("paused")
    end
  end

  describe "PATCH /api/v1/iot_rules/:id/resume" do
    let!(:rule) { create(:iot_rule, :paused, asset: asset, organization: org) }

    it "resumes the rule" do
      patch "/api/v1/iot_rules/#{rule.id}/resume", headers: admin_headers
      expect(response).to have_http_status(:ok)
      expect(rule.reload.status).to eq("active")
    end
  end

  # ── POST /api/v1/iot_rules/:id/test ──────────────────────────────────────

  describe "POST /api/v1/iot_rules/:id/test" do
    it "returns would_trigger true when value breaches threshold" do
      post "/api/v1/iot_rules/#{rule.id}/test",
        params: { value: 99.0 }.to_json,
        headers: admin_headers.merge("Content-Type" => "application/json")

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body["would_trigger"]).to be true
    end

    it "returns would_trigger false when value is within range" do
      post "/api/v1/iot_rules/#{rule.id}/test",
        params: { value: 50.0 }.to_json,
        headers: admin_headers.merge("Content-Type" => "application/json")

      body = JSON.parse(response.body)
      expect(body["would_trigger"]).to be false
    end

    it "reflects cooldown_active accurately" do
      rule.update!(last_wo_created_at: 30.minutes.ago, cooldown_minutes: 60)
      post "/api/v1/iot_rules/#{rule.id}/test",
        params: { value: 99.0 }.to_json,
        headers: admin_headers.merge("Content-Type" => "application/json")

      body = JSON.parse(response.body)
      expect(body["cooldown_active"]).to be true
      expect(body["would_create_wo"]).to be false
    end

    it "forbids technician from using test endpoint" do
      post "/api/v1/iot_rules/#{rule.id}/test",
        params: { value: 99.0 }.to_json,
        headers: tech_headers.merge("Content-Type" => "application/json")
      expect(response).to have_http_status(:forbidden)
    end
  end

  # ── DELETE /api/v1/iot_rules/:id ─────────────────────────────────────────

  describe "DELETE /api/v1/iot_rules/:id" do
    it "archives the rule (does not hard-delete)" do
      delete "/api/v1/iot_rules/#{rule.id}", headers: admin_headers
      expect(response).to have_http_status(:no_content)
      expect(rule.reload.status).to eq("archived")
      expect(IotRule.exists?(rule.id)).to be true
    end
  end
end
