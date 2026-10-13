require "rails_helper"

# Spies read better here than expectations set up front: the point is what was sent where.
# rubocop:disable RSpec/MessageSpies

RSpec.describe "Api::V1::EmailSettings", type: :request do
  let(:org)     { create(:organization) }
  let(:admin)   { create(:user, :admin, organization: org, email: "boss@acme.com") }
  let(:manager) { create(:user, :manager, organization: org) }
  let(:smtp)    {
    { host: "smtp.acme.com", port: 587, username: "mail@acme.com", password: "s3cret", encryption: "tls", from_name: "Acme",
   from_address: "mail@acme.com" }
  }
  let(:fake)    { instance_double(Mail::SMTP, deliver!: true) }

  before do
    allow(Mail::SMTP).to receive(:new).and_call_original
    allow(Mail::SMTP).to receive(:new).with(hash_including(address: anything)).and_return(fake)
  end

  describe "GET /api/v1/email_settings" do
    it "says nothing is set up, with defaults" do
      get "/api/v1/email_settings", headers: auth_headers_for(admin)

      expect(response).to have_http_status(:ok)
      expect(json_body["smtp"]).to include("host" => "", "port" => 587, "encryption" => "tls", "password_set" => false)
    end

    it "is for administrators only" do
      get "/api/v1/email_settings", headers: auth_headers_for(manager)
      expect(response).to have_http_status(:forbidden)
    end

    it "requires signing in" do
      get "/api/v1/email_settings"
      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "PATCH /api/v1/email_settings" do
    it "saves the settings, and never sends the password back" do
      patch "/api/v1/email_settings", params: { smtp: smtp }, headers: auth_headers_for(admin), as: :json

      expect(response).to have_http_status(:ok)
      expect(json_body["smtp"]).to include("host" => "smtp.acme.com", "configured" => true, "source" => "settings",
"password_set" => true)
      expect(response.body).not_to include("s3cret")
      expect(org.reload.smtp_config.password).to eq("s3cret")
    end

    it "keeps the saved password when the form does not change it" do
      patch "/api/v1/email_settings", params: { smtp: smtp }, headers: auth_headers_for(admin), as: :json
      patch "/api/v1/email_settings", params: { smtp: smtp.merge(host: "smtp2.acme.com", password: "") },
headers: auth_headers_for(admin), as: :json

      expect(org.reload.smtp_config).to have_attributes(host: "smtp2.acme.com", password: "s3cret")
    end

    it "explains what is wrong, and saves nothing" do
      patch "/api/v1/email_settings", params: { smtp: smtp.merge(host: "", from_address: "nope") }, headers: auth_headers_for(admin),
as: :json

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body.dig("error", "message")).to be_present
      expect(org.reload.email_settings).to eq({})
    end

    it "is for administrators only" do
      patch "/api/v1/email_settings", params: { smtp: smtp }, headers: auth_headers_for(manager), as: :json
      expect(response).to have_http_status(:forbidden)
      expect(org.reload.email_settings).to eq({})
    end

    it "keeps a record of who changed the mail server, without the password" do
      patch "/api/v1/email_settings", params: { smtp: smtp }, headers: auth_headers_for(admin), as: :json

      log = ActivityLog.where(action: "email_settings.updated").last
      expect(log.user_id).to eq(admin.id)
      expect(log.metadata.to_json).not_to include("s3cret")
    end
  end

  describe "DELETE /api/v1/email_settings" do
    it "forgets the saved settings, going back to the server's environment" do
      patch "/api/v1/email_settings", params: { smtp: smtp }, headers: auth_headers_for(admin), as: :json

      delete "/api/v1/email_settings", headers: auth_headers_for(admin), as: :json

      expect(response).to have_http_status(:ok)
      expect(json_body["smtp"]).to include("host" => "", "password_set" => false, "source" => nil).or include("source" => "environment")
      expect(org.reload.email_settings).to eq({})
    end
  end

  describe "POST /api/v1/email_settings/test" do
    it "sends a test email to the signed-in administrator through the settings in the form, without saving them" do
      delivered = nil
      allow(fake).to receive(:deliver!) { |mail| delivered = mail }

      post "/api/v1/email_settings/test", params: { smtp: smtp }, headers: auth_headers_for(admin), as: :json

      expect(response).to have_http_status(:ok)
      expect(json_body).to include("success" => true)
      expect(json_body["message"]).to include("boss@acme.com")
      expect(Mail::SMTP).to have_received(:new).with(hash_including(address: "smtp.acme.com", user_name: "mail@acme.com",
password: "s3cret"))
      expect(delivered.to).to eq(["boss@acme.com"])
      expect(delivered[:from].to_s).to eq("Acme <mail@acme.com>")
      expect(org.reload.email_settings).to eq({})
    end

    it "uses the saved password when the form leaves it blank" do
      patch "/api/v1/email_settings", params: { smtp: smtp }, headers: auth_headers_for(admin), as: :json

      post "/api/v1/email_settings/test", params: { smtp: smtp.merge(password: "") }, headers: auth_headers_for(admin), as: :json

      expect(Mail::SMTP).to have_received(:new).with(hash_including(password: "s3cret"))
    end

    it "shows the reason when the mail server says no, in plain words" do
      allow(fake).to receive(:deliver!).and_raise(Net::SMTPAuthenticationError.new("535 5.7.3 Authentication unsuccessful"))

      post "/api/v1/email_settings/test", params: { smtp: smtp }, headers: auth_headers_for(admin), as: :json

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body["error"]).to include("code" => "EMAIL_TEST_FAILED")
      expect(json_body.dig("error", "message")).to eq("The mail server at smtp.acme.com:587 refused the username or password.")
    end

    it "refuses incomplete settings without trying to connect" do
      post "/api/v1/email_settings/test", params: { smtp: { host: "" } }, headers: auth_headers_for(admin), as: :json

      expect(response).to have_http_status(:unprocessable_entity)
      expect(Mail::SMTP).not_to have_received(:new)
    end

    it "is for administrators only" do
      post "/api/v1/email_settings/test", params: { smtp: smtp }, headers: auth_headers_for(manager), as: :json
      expect(response).to have_http_status(:forbidden)
      expect(Mail::SMTP).not_to have_received(:new)
    end
  end
end
# rubocop:enable RSpec/MessageSpies
