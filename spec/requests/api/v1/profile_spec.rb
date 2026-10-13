require "rails_helper"

RSpec.describe "Api::V1::Profile", type: :request do
  let(:org)  { create(:organization, name: "Acme Corp") }
  let(:user) { create(:user, :manager, organization: org, first_name: "Mia", last_name: "Chen") }

  describe "GET /api/v1/profile" do
    it "returns the signed-in user with their organization name" do
      get "/api/v1/profile", headers: auth_headers_for(user)

      expect(response).to have_http_status(:ok)
      expect(json_body["user"]).to include(
        "email" => user.email, "full_name" => "Mia Chen", "role" => "manager",
        "organization_name" => "Acme Corp", "job_title" => nil, "department" => nil
      )
    end

    it "requires authentication" do
      get "/api/v1/profile"
      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "PATCH /api/v1/profile" do
    it "updates the name, phone, job title and department" do
      patch "/api/v1/profile", headers: auth_headers_for(user), as: :json,
        params: { user: { full_name: "Mia Chen-Lopez", phone: "555-0100", job_title: "Maintenance lead", department: "Plant 2" } }

      expect(response).to have_http_status(:ok)
      expect(json_body["user"]).to include("full_name" => "Mia Chen-Lopez", "phone" => "555-0100",
                                           "job_title" => "Maintenance lead", "department" => "Plant 2")
      expect(user.reload).to have_attributes(first_name: "Mia", last_name: "Chen-Lopez", job_title: "Maintenance lead")
    end

    it "keeps everything after the first word as the last name" do
      patch "/api/v1/profile", params: { user: { full_name: "Ana de la Cruz" } }, headers: auth_headers_for(user), as: :json

      expect(user.reload).to have_attributes(first_name: "Ana", last_name: "de la Cruz")
    end

    it "rejects a single-word name and changes nothing" do
      patch "/api/v1/profile", params: { user: { full_name: "Mia" } }, headers: auth_headers_for(user), as: :json

      expect(response).to have_http_status(:unprocessable_entity)
      expect(user.reload.full_name).to eq("Mia Chen")
    end

    it "does not let the user change their email, role or organization here" do
      other_org = create(:organization)

      patch "/api/v1/profile", headers: auth_headers_for(user), as: :json,
        params: { user: { email: "new@example.com", role: "admin", organization_id: other_org.id, phone: "1" } }

      expect(response).to have_http_status(:ok)
      user.reload
      expect(user.email).not_to eq("new@example.com")
      expect(user.role).to eq("manager")
      expect(user.organization_id).to eq(org.id)
      expect(user.phone).to eq("1")
    end

    it "requires authentication" do
      patch "/api/v1/profile", params: { user: { phone: "1" } }, as: :json
      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "PATCH /api/v1/profile/password" do
    let(:new_password) { "a-much-better-pass1" }
    let(:params) do
      { user: { current_password: "password123", password: new_password, password_confirmation: new_password } }
    end

    it "changes the password" do
      patch "/api/v1/profile/password", params: params, headers: auth_headers_for(user), as: :json

      expect(response).to have_http_status(:ok)
      expect(user.reload.valid_password?(new_password)).to be true
      expect(user.valid_password?("password123")).to be false
    end

    it "signs the user out everywhere: the token used for the change stops working" do
      headers = auth_headers_for(user)
      patch "/api/v1/profile/password", params: params, headers: headers, as: :json

      get "/api/v1/profile", headers: headers
      expect(response).to have_http_status(:unauthorized)
    end

    it "lets the user sign in with the new password" do
      patch "/api/v1/profile/password", params: params, headers: auth_headers_for(user), as: :json

      reset!
      post "/api/v1/auth/sign_in", params: { user: { email: user.email, password: new_password } }, as: :json
      expect(response).to have_http_status(:ok)
    end

    it "rejects a wrong current password and keeps the old one" do
      bad = { user: params[:user].merge(current_password: "not-my-password") }
      patch "/api/v1/profile/password", params: bad, headers: auth_headers_for(user), as: :json

      expect(response).to have_http_status(:unprocessable_entity)
      expect(user.reload.valid_password?("password123")).to be true
    end

    it "rejects a confirmation that does not match" do
      bad = { user: params[:user].merge(password_confirmation: "different-pass1") }
      patch "/api/v1/profile/password", params: bad, headers: auth_headers_for(user), as: :json

      expect(response).to have_http_status(:unprocessable_entity)
      expect(user.reload.valid_password?("password123")).to be true
    end

    it "rejects a blank new password instead of treating it as no change" do
      bad = { user: { current_password: "password123", password: "", password_confirmation: "" } }
      patch "/api/v1/profile/password", params: bad, headers: auth_headers_for(user), as: :json

      expect(response).to have_http_status(:unprocessable_entity)
      expect(user.reload.valid_password?("password123")).to be true
    end

    it "requires authentication" do
      patch "/api/v1/profile/password", params: params, as: :json
      expect(response).to have_http_status(:unauthorized)
    end

    context "when guessing the current password repeatedly" do
      around do |example|
        original = Rack::Attack.cache.store
        Rack::Attack.cache.store = ActiveSupport::Cache::MemoryStore.new
        Rack::Attack.reset!
        example.run
      ensure
        Rack::Attack.reset!
        Rack::Attack.cache.store = original
      end

      it "throttles after 5 attempts a minute" do
        headers = auth_headers_for(user)
        bad = { user: params[:user].merge(current_password: "wrong") }

        6.times { patch "/api/v1/profile/password", params: bad, headers: headers, as: :json }

        expect(response).to have_http_status(:too_many_requests)
      end
    end
  end
end
