require "rails_helper"

# An administrator can turn the public request form off (Settings, Advanced).
RSpec.describe "The public request form switch", type: :request do
  let!(:company) { create(:organization) }
  let!(:asset)   { ActsAsTenant.with_tenant(company) { create(:asset, organization: company, name: "Pump 3") } }
  let!(:admin)   { create(:user, :admin, organization: company) }

  let(:request_params) do
    { work_request: { requester_name: "Kamal Perera", description: "The pump is leaking onto the floor",
                      asset_code: asset.public_code } }
  end

  def turn_off = company.update!(settings: company.settings.merge("public_requests_enabled" => false))

  def work_order_count = ActsAsTenant.without_tenant { WorkOrder.count }

  def submit(params = request_params) = post("/api/v1/work_requests", params: params, as: :json)

  describe "while it is on (the default)" do
    it "says it is open, takes requests, and looks up the label's asset" do
      get "/api/v1/public_request_form"
      expect(response.parsed_body).to eq("data" => { "open" => true })
      expect { submit }.to change { work_order_count }.by(1)
      expect(response).to have_http_status(:created)
      get "/api/v1/public_assets/#{asset.public_code}"
      expect(response).to have_http_status(:ok)
    end
  end

  describe "once an administrator has turned it off" do
    before { turn_off }

    it "says it is closed, without a sign-in" do
      get "/api/v1/public_request_form"
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body).to eq("data" => { "open" => false })
    end

    it "refuses a new request with a message a person can act on, and creates nothing" do
      expect { submit }.not_to(change { work_order_count })
      expect(response).to have_http_status(:forbidden)
      expect(response.parsed_body["error"]).to include("code" => "PUBLIC_REQUESTS_OFF",
                                                       "message" => include("turned off", "contact your maintenance team"))
    end

    it "refuses a script as well (the hidden field is no way round it), and tells it nothing about a fake success" do
      submit(request_params.deep_merge(work_request: { leave_empty: "http://spam.test" }))
      expect(response).to have_http_status(:forbidden)
      expect(response.parsed_body).not_to have_key("token")
    end

    it "does not notify the managers" do
      expect { submit }.not_to have_enqueued_job(NotifyNewRequestJob)
    end

    it "refuses the lookup the QR label's page makes" do
      get "/api/v1/public_assets/#{asset.public_code}"
      expect(response).to have_http_status(:forbidden)
      expect(response.parsed_body.dig("error", "code")).to eq("PUBLIC_REQUESTS_OFF")
    end

    it "still lets people follow a request they already made" do
      company.update!(settings: company.settings.merge("public_requests_enabled" => true))
      submit
      token = response.parsed_body["token"]
      turn_off
      get "/api/v1/work_requests/#{token}"
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body.dig("data", "status")).to eq("received")
    end

    it "takes requests again when it is turned back on" do
      company.update!(settings: company.settings.merge("public_requests_enabled" => true))
      expect { submit }.to change { work_order_count }.by(1)
    end
  end

  describe "turning it off" do
    def patch_setting(value, as: admin)
      patch "/api/v1/organization_settings", params: { organization: { public_requests_enabled: value } },
                                             headers: auth_headers_for(as), as: :json
    end

    it "is done by an administrator, and takes effect at once" do
      patch_setting(false)
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body.dig("organization", "public_requests_enabled")).to be(false)
      expect { submit }.not_to(change { work_order_count })
      expect(response).to have_http_status(:forbidden)
      patch_setting(true)
      expect { submit }.to change { work_order_count }.by(1)
    end

    it "is not for managers, technicians or requesters" do
      people = [create(:user, :manager, organization: company), create(:user, organization: company),
                create(:user, :requester, organization: company)]
      people.each do |person|
        patch_setting(false, as: person)
        expect(response).to have_http_status(:forbidden)
      end
      get "/api/v1/public_request_form"
      expect(response.parsed_body.dig("data", "open")).to be(true)
    end

    it "is on until someone turns it off" do
      get "/api/v1/organization_settings", headers: auth_headers_for(admin)
      expect(response.parsed_body.dig("organization", "public_requests_enabled")).to be(true)
    end
  end
end
