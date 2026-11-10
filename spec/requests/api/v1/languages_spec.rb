require "rails_helper"

RSpec.describe "Languages", type: :request do
  let(:org)   { create(:organization) }
  let(:admin) { create(:user, :admin, organization: org) }
  let(:user)  { create(:user, :manager, organization: org) }

  describe "a person's own language (PATCH /api/v1/profile)" do
    it "is saved, and shows with the language that applies to them" do
      patch "/api/v1/profile", params: { user: { locale: "es" } }, headers: auth_headers_for(user), as: :json

      expect(response).to have_http_status(:ok)
      expect(json_body["user"]).to include("locale" => "es", "language" => "es")
      expect(user.reload.locale).to eq("es")
    end

    it "falls back to the company's language when cleared" do
      org.update!(settings: { "language" => "es" })
      user.update!(locale: "en")

      patch "/api/v1/profile", params: { user: { locale: "" } }, headers: auth_headers_for(user), as: :json

      expect(json_body["user"]).to include("locale" => nil, "language" => "es")
    end

    it "refuses a language that is not offered" do
      patch "/api/v1/profile", params: { user: { locale: "xx" } }, headers: auth_headers_for(user), as: :json

      expect(response).to have_http_status(:unprocessable_content)
      expect(user.reload.locale).to be_nil
    end
  end

  describe "the company's language (PATCH /api/v1/localization_settings)" do
    it "is set by an administrator and read by everyone" do
      patch "/api/v1/localization_settings", params: { localization: { language: "es" } }, headers: auth_headers_for(admin), as: :json
      expect(response).to have_http_status(:ok)

      get "/api/v1/localization_settings", headers: auth_headers_for(user)
      expect(json_body["localization"]["language"]).to eq("es")
      expect(org.reload.language).to eq("es")
    end

    it "is refused for anyone else, and for a language that is not offered" do
      patch "/api/v1/localization_settings", params: { localization: { language: "es" } }, headers: auth_headers_for(user), as: :json
      expect(response).to have_http_status(:forbidden)

      patch "/api/v1/localization_settings", params: { localization: { language: "xx" } }, headers: auth_headers_for(admin), as: :json
      expect(response).to have_http_status(:unprocessable_content)
      expect(org.reload.language).to eq("en")
    end
  end

  it "answers a request in the language of the person who made it" do
    user.update!(locale: "es")
    expect(I18n).to receive(:with_locale).with("es").and_call_original

    get "/api/v1/profile", headers: auth_headers_for(user)
  end
end
