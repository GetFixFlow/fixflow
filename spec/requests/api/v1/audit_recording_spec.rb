require "rails_helper"

# The audit log as someone using the app causes it: who, from where, and one line (not hundreds) for a bulk change.
RSpec.describe "Audit recording through the API", type: :request do
  let(:org)     { create(:organization) }
  let!(:admin)  { create(:user, :admin, organization: org, first_name: "Ada", last_name: "Admin", password: "password123") }
  let!(:manager) { create(:user, :manager, organization: org, first_name: "Mo", last_name: "Manager") }

  def lines(where = {}) = ActivityLog.where(organization_id: org.id).where(where).order(:id)

  describe "creating and editing through the screens" do
    it "names the person and the address, for a create and for an edit" do
      headers = auth_headers_for(manager)
      ActivityLog.delete_all
      post "/api/v1/assets", params: { asset: { name: "Boiler 1", status: "operational" } }, headers: headers, as: :json
      expect(response).to have_http_status(:created)
      id = response.parsed_body.dig("data", "id")
      patch "/api/v1/assets/#{id}", params: { asset: { status: "down" } }, headers: headers, as: :json

      expect(lines(resource_type: "Asset").map { |line| [line.action, line.user_id, line.ip_address, line.metadata] }).to eq(
        [["asset.created", manager.id, "127.0.0.1", {}],
         ["asset.updated", manager.id, "127.0.0.1", { "changed" => ["status"] }]]
      )
    end

    it "writes a line for a delete" do
      asset = create(:asset, organization: org, name: "Old press")
      headers = auth_headers_for(admin) # only administrators may delete an asset
      ActivityLog.delete_all
      delete "/api/v1/assets/#{asset.id}", headers: headers
      expect(response).to have_http_status(:no_content)
      expect(lines.pluck(:action, :resource_name, :user_id)).to eq([["asset.deleted", "Old press", admin.id]])
    end
  end

  describe "signing in" do
    it "writes a line with the person and the address" do
      ActivityLog.delete_all
      post "/api/v1/auth/sign_in", params: { user: { email: admin.email, password: "password123" } }, as: :json,
                                   headers: { "User-Agent" => "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) Safari/605.1.15" }
      expect(response).to have_http_status(:ok)
      line = lines(action: "user.signed_in").sole
      expect(line).to have_attributes(user_id: admin.id, resource_name: "Ada Admin", ip_address: "127.0.0.1")
      expect(line.metadata["device"]).to be_present
    end

    it "writes no line for a wrong password" do
      ActivityLog.delete_all
      post "/api/v1/auth/sign_in", params: { user: { email: admin.email, password: "wrong" } }, as: :json
      expect(response).to have_http_status(:unauthorized)
      expect(lines).to be_empty
    end
  end

  describe "an import" do
    it "writes one line for the whole file, not one for every row" do
      csv = "name,location\nBoiler A,\nBoiler B,\nBoiler C,\n"
      file = { file: Rack::Test::UploadedFile.new(StringIO.new(csv), "text/csv", original_filename: "assets.csv") }
      headers = auth_headers_for(manager)
      ActivityLog.delete_all
      post "/api/v1/imports/assets", params: file, headers: headers
      expect(response).to have_http_status(:created)
      expect(Asset.where(organization_id: org.id).count).to eq(3)
      expect(lines.pluck(:action)).to eq(["import.assets"])
    end
  end

  describe "company settings" do
    it "writes one line naming the settings that changed, never their values" do
      headers = auth_headers_for(admin)
      ActivityLog.delete_all
      patch "/api/v1/organization_settings", params: { organization: { labor_rate: 61.25, default_priority: "high" } },
                                             headers: headers, as: :json
      line = lines(action: "organization_settings.updated").sole
      expect(line.metadata["changed"]).to contain_exactly("labor_rate", "default_priority")
      expect(line.metadata.to_s).not_to include("61.25")
      expect(line).to have_attributes(user_id: admin.id, resource_name: org.name)
    end

    it "writes nothing when nothing changed" do
      headers = auth_headers_for(admin)
      ActivityLog.delete_all
      same = org.settings_with_defaults["default_priority"]
      patch "/api/v1/organization_settings", params: { organization: { default_priority: same } }, headers: headers, as: :json
      expect(lines(action: "organization_settings.updated")).to be_empty
    end
  end

  describe "the dashboards' recent activity" do
    it "shows the work, not who signed in" do
      create(:activity_log, organization: org, user: admin, action: "asset.updated", resource_name: "Pump")
      auth_headers_for(admin) # signs in: writes a sign-in line
      get "/api/v1/dashboard", headers: auth_headers_for(manager)
      types = response.parsed_body["recent_activity"].pluck("type")
      expect(types).to include("asset.updated")
      expect(types).not_to include("user.signed_in")
    end
  end
end
