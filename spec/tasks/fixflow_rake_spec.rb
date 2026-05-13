require "rails_helper"
require "rake"

RSpec.describe "fixflow rake tasks", type: :task do
  before(:all) do
    Rails.application.load_tasks
  end

  describe "fixflow:create_admin" do
    it "creates an organization and admin user" do
      ActsAsTenant.without_tenant do
        expect {
          Rake::Task["fixflow:create_admin"].execute(
            email: "tasktest@example.com",
            password: "password123",
            org_name: "Task Test Org"
          )
        }.to change(Organization, :count).by(1).and change(User, :count).by(1)

        user = User.find_by(email: "tasktest@example.com")
        expect(user).to be_present
        expect(user.admin?).to be true
        expect(user.organization.name).to eq("Task Test Org")
      end
    end
  end

  describe "fixflow:create_api_key" do
    it "creates an API key and outputs the raw key" do
      org = create(:organization)
      expect {
        ActsAsTenant.without_tenant do
          Rake::Task["fixflow:create_api_key"].execute(org_id: org.id.to_s, name: "Test Device")
        end
      }.to change(ApiKey, :count).by(1)
    end
  end

  describe "fixflow:stats" do
    it "runs without error" do
      expect { Rake::Task["fixflow:stats"].execute }.not_to raise_error
    end
  end
end
