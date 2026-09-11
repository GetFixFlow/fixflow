require "rails_helper"

RSpec.describe "Api::V1::Locations", type: :request do
  let(:org)      { create(:organization) }
  let(:manager)  { create(:user, :manager,    organization: org) }
  let(:admin)    { create(:user, :admin,      organization: org) }
  let(:tech)     { create(:user,              organization: org) }

  # ─── GET /api/v1/locations ────────────────────────────────────────────────

  describe "GET /api/v1/locations" do
    let!(:site)     { create(:location, organization: org, name: "HQ Site") }
    let!(:building) { create(:location, :building, organization: org, name: "Main Building", parent: site) }
    let!(:room)     { create(:location, :room,     organization: org, name: "Server Room",  parent: building) }

    it "returns a tree of root locations with nested children" do
      get "/api/v1/locations", headers: auth_headers_for(manager), as: :json

      expect(response).to have_http_status(:ok)
      roots = json_body["locations"]
      expect(roots.size).to eq(1)

      root = roots.first
      expect(root["name"]).to eq("HQ Site")
      expect(root["depth"]).to eq(0)
      expect(root["children"].size).to eq(1)

      child = root["children"].first
      expect(child["name"]).to eq("Main Building")
      expect(child["depth"]).to eq(1)
      expect(child["children"].size).to eq(1)
      expect(child["children"].first["name"]).to eq("Server Room")
    end

    it "only returns locations from the current user's organization" do
      other_org  = create(:organization)
      create(:location, organization: other_org, name: "Other Org Site")

      get "/api/v1/locations", headers: auth_headers_for(manager), as: :json

      names = json_body["locations"].map { |l| l["name"] }
      expect(names).not_to include("Other Org Site")
    end

    it "returns 401 without authentication" do
      get "/api/v1/locations", as: :json
      expect(response).to have_http_status(:unauthorized)
    end
  end

  # ─── GET /api/v1/locations/:id ────────────────────────────────────────────

  describe "GET /api/v1/locations/:id" do
    let!(:site)     { create(:location, organization: org, name: "HQ") }
    let!(:building) { create(:location, :building, organization: org, name: "Block A", parent: site) }

    it "returns the location with extended fields and children" do
      get "/api/v1/locations/#{site.id}", headers: auth_headers_for(tech), as: :json

      expect(response).to have_http_status(:ok)
      expect(json_body["data"]["name"]).to eq("HQ")
      expect(json_body["full_path"]).to eq("HQ")
      expect(json_body["depth"]).to eq(0)
      expect(json_body["children"].first["name"]).to eq("Block A")
    end

    it "returns 404 for a location in another organization" do
      other = create(:location, organization: create(:organization))
      get "/api/v1/locations/#{other.id}", headers: auth_headers_for(tech), as: :json
      expect(response).to have_http_status(:not_found)
    end
  end

  # ─── POST /api/v1/locations ───────────────────────────────────────────────

  describe "POST /api/v1/locations" do
    let(:valid_params) { { location: { name: "Warehouse A", location_type: "site" } } }

    context "as a manager" do
      it "creates the location and returns 201" do
        post "/api/v1/locations", params: valid_params,
          headers: auth_headers_for(manager), as: :json

        expect(response).to have_http_status(:created)
        expect(json_body["data"]["name"]).to eq("Warehouse A")
        expect(json_body["location_type"]).to eq("site")
      end

      it "creates a child location under a parent" do
        site = create(:location, organization: org)
        post "/api/v1/locations",
          params: { location: { name: "Floor 1", location_type: "floor", parent_id: site.id } },
          headers: auth_headers_for(manager), as: :json

        expect(response).to have_http_status(:created)
        expect(json_body["parent_id"]).to eq(site.id)
        expect(json_body["depth"]).to eq(1)
      end
    end

    context "as a technician" do
      it "returns 403 Forbidden" do
        post "/api/v1/locations", params: valid_params,
          headers: auth_headers_for(tech), as: :json

        expect(response).to have_http_status(:forbidden)
      end
    end

    context "with invalid params" do
      it "returns 422 for missing name" do
        post "/api/v1/locations",
          params: { location: { location_type: "site" } },
          headers: auth_headers_for(manager), as: :json

        expect(response).to have_http_status(:unprocessable_entity)
      end

      it "returns 422 for invalid location_type" do
        post "/api/v1/locations",
          params: { location: { name: "X", location_type: "garage" } },
          headers: auth_headers_for(manager), as: :json

        expect(response).to have_http_status(:unprocessable_entity)
      end
    end
  end

  # ─── PATCH /api/v1/locations/:id ──────────────────────────────────────────

  describe "PATCH /api/v1/locations/:id" do
    let!(:site) { create(:location, organization: org, name: "Old Name") }

    it "updates the location name" do
      patch "/api/v1/locations/#{site.id}",
        params: { location: { name: "New Name" } },
        headers: auth_headers_for(manager), as: :json

      expect(response).to have_http_status(:ok)
      expect(json_body["data"]["name"]).to eq("New Name")
    end

    it "returns 422 when a circular parent is detected" do
      child = create(:location, :building, organization: org, parent: site)

      patch "/api/v1/locations/#{site.id}",
        params: { location: { parent_id: child.id } },
        headers: auth_headers_for(manager), as: :json

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body["error"]).to match(/circular/i)
    end

    it "returns 403 for a technician" do
      patch "/api/v1/locations/#{site.id}",
        params: { location: { name: "Hack" } },
        headers: auth_headers_for(tech), as: :json

      expect(response).to have_http_status(:forbidden)
    end
  end

  # ─── DELETE /api/v1/locations/:id ─────────────────────────────────────────

  describe "DELETE /api/v1/locations/:id" do
    let!(:site) { create(:location, organization: org) }

    it "deletes the location and returns 204 when called by admin" do
      delete "/api/v1/locations/#{site.id}", headers: auth_headers_for(admin), as: :json

      expect(response).to have_http_status(:no_content)
      expect(Location.find_by(id: site.id)).to be_nil
    end

    it "returns 403 for a manager" do
      delete "/api/v1/locations/#{site.id}", headers: auth_headers_for(manager), as: :json
      expect(response).to have_http_status(:forbidden)
    end

    it "returns 403 for a technician" do
      delete "/api/v1/locations/#{site.id}", headers: auth_headers_for(tech), as: :json
      expect(response).to have_http_status(:forbidden)
    end
  end
end
