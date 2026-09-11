require "rails_helper"

RSpec.describe "Api::V1::Assets", type: :request do
  let(:org)     { create(:organization) }
  let(:admin)   { create(:user, :admin,   organization: org) }
  let(:manager) { create(:user, :manager, organization: org) }
  let(:tech)    { create(:user,           organization: org) }

  # ─── GET /api/v1/assets ───────────────────────────────────────────────────

  describe "GET /api/v1/assets" do
    let!(:asset_a) { create(:asset, organization: org, name: "Pump Alpha",   status: "operational") }
    let!(:asset_b) { create(:asset, organization: org, name: "Pump Beta",    status: "down") }
    let!(:asset_c) { create(:asset, :discarded, organization: org, name: "Old Pump") }

    it "returns paginated list of non-discarded assets" do
      get "/api/v1/assets", headers: auth_headers_for(tech), as: :json

      expect(response).to have_http_status(:ok)
      names = json_body["assets"].map { |a| a["name"] }
      expect(names).to include("Pump Alpha", "Pump Beta")
      expect(names).not_to include("Old Pump")
      expect(json_body["meta"]).to include("current_page", "total_count")
    end

    it "filters by status" do
      get "/api/v1/assets", params: { status: "down" },
        headers: auth_headers_for(tech), as: :json

      expect(response).to have_http_status(:ok)
      names = json_body["assets"].map { |a| a["name"] }
      expect(names).to include("Pump Beta")
      expect(names).not_to include("Pump Alpha")
    end

    it "filters by location_id" do
      location = create(:location, organization: org)
      asset_at_location = create(:asset, organization: org, location: location, name: "Located Pump")

      get "/api/v1/assets", params: { location_id: location.id },
        headers: auth_headers_for(tech), as: :json

      names = json_body["assets"].map { |a| a["name"] }
      expect(names).to eq(["Located Pump"])
    end

    it "searches by name" do
      get "/api/v1/assets", params: { search: "Alpha" },
        headers: auth_headers_for(tech), as: :json

      names = json_body["assets"].map { |a| a["name"] }
      expect(names).to include("Pump Alpha")
      expect(names).not_to include("Pump Beta")
    end

    it "searches by asset_tag" do
      target = create(:asset, organization: org, name: "Tagged Asset", asset_tag: "FF-999999")
      get "/api/v1/assets", params: { search: "FF-999999" },
        headers: auth_headers_for(tech), as: :json

      names = json_body["assets"].map { |a| a["name"] }
      expect(names).to include("Tagged Asset")
    end

    it "only returns assets from the current organization" do
      other_org = create(:organization)
      create(:asset, organization: other_org, name: "Foreign Asset")

      get "/api/v1/assets", headers: auth_headers_for(tech), as: :json

      names = json_body["assets"].map { |a| a["name"] }
      expect(names).not_to include("Foreign Asset")
    end

    it "returns 401 without authentication" do
      get "/api/v1/assets", as: :json
      expect(response).to have_http_status(:unauthorized)
    end
  end

  # ─── GET /api/v1/assets/:id ───────────────────────────────────────────────

  describe "GET /api/v1/assets/:id" do
    let!(:asset) { create(:asset, organization: org) }

    it "returns the asset with extended fields" do
      get "/api/v1/assets/#{asset.id}", headers: auth_headers_for(tech), as: :json

      expect(response).to have_http_status(:ok)
      expect(json_body["data"]["id"]).to eq(asset.id)
      expect(json_body["data"]["asset_tag"]).to be_present
      expect(json_body["open_work_orders_count"]).to eq(0)
    end

    it "returns 404 for an asset in another organization" do
      other = create(:asset, organization: create(:organization))
      get "/api/v1/assets/#{other.id}", headers: auth_headers_for(tech), as: :json
      expect(response).to have_http_status(:not_found)
    end
  end

  # ─── POST /api/v1/assets ──────────────────────────────────────────────────

  describe "POST /api/v1/assets" do
    let(:valid_params) { { asset: { name: "New Compressor", status: "operational" } } }

    context "as a manager" do
      it "creates the asset and returns 201 with auto-generated FF- tag" do
        post "/api/v1/assets", params: valid_params,
          headers: auth_headers_for(manager), as: :json

        expect(response).to have_http_status(:created)
        expect(json_body["data"]["name"]).to eq("New Compressor")
        expect(json_body["data"]["asset_tag"]).to match(/\AFF-\d{6}\z/)
      end

      it "uses a provided asset_tag" do
        post "/api/v1/assets",
          params: { asset: { name: "Custom Tag Asset", status: "operational", asset_tag: "FF-888888" } },
          headers: auth_headers_for(manager), as: :json

        expect(response).to have_http_status(:created)
        expect(json_body["data"]["asset_tag"]).to eq("FF-888888")
      end

      it "stores custom_fields as jsonb" do
        post "/api/v1/assets",
          params: { asset: { name: "Pump", status: "operational", custom_fields: { rpm: 1500, voltage: "480V" } } },
          headers: auth_headers_for(manager), as: :json

        expect(response).to have_http_status(:created)
        expect(json_body["data"]["custom_fields"]["rpm"]).to eq(1500)
      end
    end

    context "as a technician" do
      it "returns 403 Forbidden" do
        post "/api/v1/assets", params: valid_params,
          headers: auth_headers_for(tech), as: :json

        expect(response).to have_http_status(:forbidden)
      end
    end

    context "with invalid params" do
      it "returns 422 for missing name" do
        post "/api/v1/assets",
          params: { asset: { status: "operational" } },
          headers: auth_headers_for(manager), as: :json

        expect(response).to have_http_status(:unprocessable_entity)
      end
    end
  end

  # ─── PATCH /api/v1/assets/:id ─────────────────────────────────────────────

  describe "PATCH /api/v1/assets/:id" do
    let!(:asset) { create(:asset, organization: org, status: "operational") }

    it "updates the asset" do
      patch "/api/v1/assets/#{asset.id}",
        params: { asset: { status: "degraded" } },
        headers: auth_headers_for(manager), as: :json

      expect(response).to have_http_status(:ok)
      expect(json_body["data"]["status"]).to eq("degraded")
    end

    it "returns 403 for a technician" do
      patch "/api/v1/assets/#{asset.id}",
        params: { asset: { status: "down" } },
        headers: auth_headers_for(tech), as: :json

      expect(response).to have_http_status(:forbidden)
    end
  end

  # ─── DELETE /api/v1/assets/:id (soft delete) ──────────────────────────────

  describe "DELETE /api/v1/assets/:id" do
    let!(:asset) { create(:asset, organization: org, name: "To Retire") }

    it "soft-deletes the asset (sets discarded_at) and returns 204" do
      delete "/api/v1/assets/#{asset.id}", headers: auth_headers_for(admin), as: :json

      expect(response).to have_http_status(:no_content)
      expect(asset.reload.discarded_at).not_to be_nil
    end

    it "hides the discarded asset from the list" do
      delete "/api/v1/assets/#{asset.id}", headers: auth_headers_for(admin), as: :json

      get "/api/v1/assets", headers: auth_headers_for(tech), as: :json
      names = json_body["assets"].map { |a| a["name"] }
      expect(names).not_to include("To Retire")
    end

    it "returns 403 for a manager" do
      delete "/api/v1/assets/#{asset.id}", headers: auth_headers_for(manager), as: :json
      expect(response).to have_http_status(:forbidden)
    end
  end

  # ─── GET /api/v1/assets/:id/history ──────────────────────────────────────

  describe "GET /api/v1/assets/:id/history" do
    let!(:asset)      { create(:asset, organization: org) }
    let!(:work_order) { create(:work_order, organization: org, asset: asset) }

    it "returns work orders for the asset" do
      get "/api/v1/assets/#{asset.id}/history", headers: auth_headers_for(tech), as: :json

      expect(response).to have_http_status(:ok)
      expect(json_body["work_orders"].size).to eq(1)
      expect(json_body["work_orders"].first["id"]).to eq(work_order.id)
    end

    it "works even for a discarded (soft-deleted) asset" do
      asset.discard!

      get "/api/v1/assets/#{asset.id}/history", headers: auth_headers_for(tech), as: :json
      expect(response).to have_http_status(:ok)
    end
  end

  # ─── POST /api/v1/assets/:id/qr_code ─────────────────────────────────────

  describe "POST /api/v1/assets/:id/qr_code" do
    let!(:asset) { create(:asset, organization: org) }

    it "returns a PNG image with correct content-type" do
      post "/api/v1/assets/#{asset.id}/qr_code",
        headers: auth_headers_for(tech), as: :json

      expect(response).to have_http_status(:ok)
      expect(response.content_type).to include("image/png")
      # PNG magic bytes
      expect(response.body.bytes.first(4)).to eq([137, 80, 78, 71])
    end

    it "returns 404 for an asset in another organization" do
      other = create(:asset, organization: create(:organization))
      post "/api/v1/assets/#{other.id}/qr_code",
        headers: auth_headers_for(tech), as: :json

      expect(response).to have_http_status(:not_found)
    end
  end
end
