require "rails_helper"

RSpec.describe "Api::V1::Users", type: :request do
  let(:org)     { create(:organization) }
  let(:admin)   { create(:user, :admin,   organization: org) }
  let(:manager) { create(:user, :manager, organization: org) }
  let!(:target) { create(:user, organization: org) }

  describe "DELETE /api/v1/users/:id" do
    it "forbids a manager and leaves the user in place" do
      delete "/api/v1/users/#{target.id}", headers: auth_headers_for(manager)

      expect(response).to have_http_status(:forbidden)
      expect(User.exists?(target.id)).to be true
    end

    it "lets an admin delete a user" do
      delete "/api/v1/users/#{target.id}", headers: auth_headers_for(admin)

      expect(response).to have_http_status(:no_content)
      expect(User.exists?(target.id)).to be false
    end
  end
end
