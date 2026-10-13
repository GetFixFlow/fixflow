require "rails_helper"

RSpec.describe "Api::V1::Branding", type: :request do
  let!(:org)    { create(:organization, name: "Acme Corp") }
  let(:admin)   { create(:user, :admin, organization: org) }
  let(:manager) { create(:user, :manager, organization: org) }
  let(:png)     { fixture_file_upload("pixel.png", "image/png") }

  def patch_branding(as: admin, **params)
    patch "/api/v1/branding", params: { branding: params }, headers: auth_headers_for(as)
  end

  describe "GET /api/v1/branding" do
    it "is public, so the sign-in page can show it before anyone has signed in" do
      get "/api/v1/branding"

      expect(response).to have_http_status(:ok)
      expect(json_body["branding"]).to include(
        "name" => "Acme Corp", "primary_color" => "#2563eb",
        "login_headline" => "Sign in to FixFlow", "login_subtitle" => "Enter your credentials to continue",
        "logo_url" => nil, "favicon_url" => nil
      )
    end

    it "still answers on a brand-new install with no company yet" do
      Organization.delete_all

      get "/api/v1/branding"

      expect(response).to have_http_status(:ok)
      expect(json_body["branding"]).to include("name" => "FixFlow", "primary_color" => "#2563eb")
    end
  end

  describe "PATCH /api/v1/branding" do
    it "saves the colour and the sign-in text, and they survive a reload" do
      patch_branding(primary_color: "#16A34A", login_headline: "Acme Maintenance", login_subtitle: "Sign in with your work email")

      expect(response).to have_http_status(:ok)
      get "/api/v1/branding"
      expect(json_body["branding"]).to include("primary_color" => "#16a34a", "login_headline" => "Acme Maintenance",
"login_subtitle" => "Sign in with your work email")
    end

    it "stores a logo and a favicon and gives links that work without signing in" do
      patch_branding(logo: png, favicon: fixture_file_upload("pixel.png", "image/png"))

      expect(response).to have_http_status(:ok)
      logo_url = json_body.dig("branding", "logo_url")
      expect(logo_url).to start_with("/api/v1/storage/")
      expect(json_body.dig("branding", "favicon_url")).to start_with("/api/v1/storage/")

      get "/api/v1/branding"
      expect(json_body.dig("branding", "logo_url")).to eq(logo_url)
      get logo_url
      expect(response).to have_http_status(:redirect)
    end

    it "removes a logo when asked, without touching the rest" do
      patch_branding(logo: png)
      patch_branding(remove_logo: "true", login_headline: "Hello")

      expect(json_body["branding"]).to include("logo_url" => nil, "login_headline" => "Hello")
      expect(org.reload.logo).not_to be_attached
    end

    it "replaces a logo" do
      patch_branding(logo: png)
      first = json_body.dig("branding", "logo_url")
      patch_branding(logo: fixture_file_upload("pixel.png", "image/png"))

      expect(json_body.dig("branding", "logo_url")).not_to eq(first)
    end

    it "refuses a colour that is not a colour, saving nothing" do
      patch_branding(primary_color: "blue", login_headline: "Changed")

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body.dig("error", "message")).to include("#2563eb")
      expect(org.reload.branding["login_headline"]).to eq("Sign in to FixFlow")
    end

    it "refuses a colour too light for the white text that goes on it" do
      patch_branding(primary_color: "#ffeb3b")

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body.dig("error", "message")).to include("too light")
    end

    it "accepts the colours of the presets the page offers" do
      %w[#2563eb #16a34a #475569 #1e3a5f #7c3aed].each do |hex|
        patch_branding(primary_color: hex)
        expect(response).to have_http_status(:ok), "#{hex} was refused"
      end
    end

    it "limits the sign-in text" do
      patch_branding(login_headline: "")
      expect(response).to have_http_status(:unprocessable_entity)

      patch_branding(login_headline: "x" * 81)
      expect(response).to have_http_status(:unprocessable_entity)

      patch_branding(login_subtitle: "x" * 161)
      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "refuses something that is not an image, whatever it is called" do
      html = Rack::Test::UploadedFile.new(StringIO.new("<script>alert(1)</script>"), "image/png", original_filename: "logo.png")

      patch_branding(logo: html)

      expect(response).to have_http_status(:unprocessable_entity)
      expect(org.reload.logo).not_to be_attached
    end

    it "refuses an SVG, which can carry scripts" do
      svg = Rack::Test::UploadedFile.new(StringIO.new('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
"image/svg+xml", original_filename: "logo.svg")

      patch_branding(logo: svg)

      expect(response).to have_http_status(:unprocessable_entity)
      expect(org.reload.logo).not_to be_attached
    end

    it "refuses a logo over 2 MB" do
      stub_const("OrganizationBranding::LOGO_MAX_BYTES", 10)

      patch_branding(logo: png)

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body.dig("error", "message")).to include("2048 KB").or include("KB or smaller")
      expect(org.reload.logo).not_to be_attached
    end

    it "is for administrators only" do
      patch_branding(as: manager, primary_color: "#16a34a")

      expect(response).to have_http_status(:forbidden)
      expect(org.reload.branding["primary_color"]).to eq("#2563eb")
    end

    it "requires signing in" do
      patch "/api/v1/branding", params: { branding: { primary_color: "#16a34a" } }
      expect(response).to have_http_status(:unauthorized)
    end

    it "keeps a record of who changed it" do
      patch_branding(primary_color: "#16a34a")

      expect(ActivityLog.where(action: "branding.updated").last.user_id).to eq(admin.id)
    end
  end
end
