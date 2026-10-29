require "rails_helper"

RSpec.describe "Password rules where a password is chosen", type: :request do
  let(:person) { create(:user) }

  def change_password_to(password)
    patch "/api/v1/profile/password", headers: auth_headers_for(person), as: :json,
                                      params: { user: { current_password: "password123", password: password,
                                                        password_confirmation: password } }
  end

  it "refuses a weak one when signing up" do
    post "/api/v1/auth/sign_up", as: :json,
                                 params: { user: { email: "founder@startup.io", password: "password123",
                                                   password_confirmation: "password123", first_name: "Al", last_name: "Founder",
                                                   organization_name: "Startup" } }

    expect(response).to have_http_status(:unprocessable_entity)
    expect(response.parsed_body.to_s).to include("too common")
    expect(User.count).to eq(0)
  end

  it "refuses a weak one on a password change, and keeps the old one" do
    change_password_to("letmein-letmein")

    expect(response).to have_http_status(:unprocessable_entity)
    expect(person.reload.valid_password?("password123")).to be(true)
  end

  it "refuses one that is too short, with the length in the message" do
    change_password_to("Xq7!mR2$k")

    expect(response).to have_http_status(:unprocessable_entity)
    expect(response.parsed_body.to_s).to include("minimum is 10 characters")
  end

  it "takes a good one on a password change" do
    change_password_to("Blue-Ladder-4721-Kite")

    expect(response).to have_http_status(:ok)
    expect(person.reload.valid_password?("Blue-Ladder-4721-Kite")).to be(true)
  end

  it "refuses a weak one when a password is reset with the link" do
    token = person.send(:set_reset_password_token)
    put "/api/v1/auth/password", as: :json,
                                 params: { user: { reset_password_token: token, password: "Password1234",
                                                   password_confirmation: "Password1234" } }

    expect(response).to have_http_status(:unprocessable_entity)
    expect(person.reload.valid_password?("password123")).to be(true)
  end
end
