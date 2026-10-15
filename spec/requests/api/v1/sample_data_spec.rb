require "rails_helper"

RSpec.describe "Sample data and getting started", type: :request do
  let(:org)        { create(:organization) }
  let(:admin)      { create(:user, :admin, organization: org) }
  let(:manager)    { create(:user, :manager, organization: org) }
  let!(:technician) { create(:user, organization: org) }

  describe "sample data" do
    it "starts out not loaded" do
      get "/api/v1/sample_data", headers: auth_headers_for(admin)

      expect(response).to have_http_status(:ok)
      expect(json_body).to include("loaded" => false)
      expect(json_body["counts"].values.sum).to eq(0)
    end

    it "loads, says what it made, and keeps a record of who did it" do
      post "/api/v1/sample_data", headers: auth_headers_for(admin), as: :json

      expect(response).to have_http_status(:created)
      expect(json_body).to include("loaded" => true)
      expect(json_body["counts"]).to include("Asset" => 5, "Part" => 4, "Location" => 3, "WorkOrder" => 9, "PreventiveMaintenance" => 1)
      expect(ActivityLog.where(action: "sample_data.loaded").last.user_id).to eq(admin.id)
    end

    it "does not load twice" do
      post "/api/v1/sample_data", headers: auth_headers_for(admin), as: :json
      post "/api/v1/sample_data", headers: auth_headers_for(admin), as: :json

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body.dig("error", "code")).to eq("SAMPLE_DATA_LOADED")
      expect(org.assets.count).to eq(5)
    end

    it "removes it again, and reports what was kept because real work depends on it" do
      post "/api/v1/sample_data", headers: auth_headers_for(admin), as: :json
      create(:work_order, organization: org, asset: org.assets.find_by(name: "Sample: Pump 01"), work_order_number: "REAL-1")

      delete "/api/v1/sample_data", headers: auth_headers_for(admin), as: :json

      expect(response).to have_http_status(:ok)
      expect(json_body["loaded"]).to be(false)
      expect(json_body.dig("report", "removed")).to include("WorkOrder" => 9, "Part" => 4)
      expect(json_body.dig("report", "kept").pluck("name")).to include("Sample: Pump 01")
      expect(org.assets.where("name LIKE ?", "Sample:%").count).to eq(1)
    end

    it "does not email or alert anyone" do
      expect { post "/api/v1/sample_data", headers: auth_headers_for(admin), as: :json }.not_to have_enqueued_job
    end

    it "is for administrators only" do
      [manager, technician].each do |person|
        post "/api/v1/sample_data", headers: auth_headers_for(person), as: :json
        expect(response).to have_http_status(:forbidden)
      end
      expect(org.assets.count).to eq(0)
    end

    it "requires signing in" do
      get "/api/v1/sample_data"
      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "getting started" do
    def steps
      json_body["steps"].to_h { |s| [s["key"], s["done"]] }
    end

    it "lists the first three things to do, none done on a new install except what already is" do
      get "/api/v1/getting_started", headers: auth_headers_for(admin)

      expect(response).to have_http_status(:ok)
      expect(steps).to eq("assets" => false, "work_order" => false, "team" => true) # the technician is already in the team
      expect(json_body).to include("all_done" => false, "dismissed" => false, "sample_loaded" => false)
      expect(json_body["steps"].first).to include("title" => "Add your equipment", "path" => "/assets/new")
    end

    it "needs a second person for the team step" do
      technician.destroy

      get "/api/v1/getting_started", headers: auth_headers_for(admin)

      expect(steps["team"]).to be(false)
    end

    it "ticks off steps from what is really there" do
      create(:asset, organization: org)
      create(:work_order, organization: org, work_order_number: "REAL-1")

      get "/api/v1/getting_started", headers: auth_headers_for(admin)

      expect(steps).to eq("assets" => true, "work_order" => true, "team" => true)
      expect(json_body["all_done"]).to be(true)
    end

    it "does not count sample data as having done anything" do
      post "/api/v1/sample_data", headers: auth_headers_for(admin), as: :json

      get "/api/v1/getting_started", headers: auth_headers_for(admin)

      expect(steps).to include("assets" => false, "work_order" => false)
      expect(json_body["sample_loaded"]).to be(true)
    end

    it "can be put away, for good" do
      post "/api/v1/getting_started/dismiss", headers: auth_headers_for(admin), as: :json

      expect(json_body["dismissed"]).to be(true)
      get "/api/v1/getting_started", headers: auth_headers_for(admin)
      expect(json_body["dismissed"]).to be(true)
    end

    it "keeps being dismissed when other company settings are saved" do
      post "/api/v1/getting_started/dismiss", headers: auth_headers_for(admin), as: :json

      patch "/api/v1/organization_settings", params: { organization: { wo_number_prefix: "MNT" } }, headers: auth_headers_for(admin),
as: :json

      expect(org.reload.getting_started_dismissed?).to be(true)
    end

    it "is for administrators only" do
      get "/api/v1/getting_started", headers: auth_headers_for(manager)
      expect(response).to have_http_status(:forbidden)

      post "/api/v1/getting_started/dismiss", headers: auth_headers_for(technician), as: :json
      expect(response).to have_http_status(:forbidden)
    end
  end
end
