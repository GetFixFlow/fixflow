require "rails_helper"
require "rake"

RSpec.describe "fixflow rake tasks", type: :task do
  # Loaded once for the whole run: loading twice makes every task do its work twice.
  before(:all) do
    Rails.application.load_tasks unless Rake::Task.task_defined?("fixflow:create_admin")
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

  describe "fixflow:reset_two_factor" do
    it "switches off a person's two-factor sign-in and signs them out everywhere" do
      user = create(:user, email: "lost.phone@example.test")
      enable_two_factor_for(user)
      old_jti = user.jti

      expect { Rake::Task["fixflow:reset_two_factor"].execute(email: " Lost.Phone@Example.test ") }
        .to output(/is off for lost.phone@example.test/).to_stdout

      expect(user.reload).not_to be_two_factor_enabled
      expect(user.jti).not_to eq(old_jti)
    end

    it "aborts for an unknown email and for a person who has it off" do
      create(:user, email: "plain@example.test")

      expect { Rake::Task["fixflow:reset_two_factor"].execute(email: "nobody@example.test") }
        .to raise_error(SystemExit).and output(/no user with the email/).to_stderr
      expect { Rake::Task["fixflow:reset_two_factor"].execute(email: "plain@example.test") }
        .to raise_error(SystemExit).and output(/does not have two-factor/).to_stderr
    end
  end

  describe "fixflow:create_admin when a company already exists" do
    it "aborts without creating another company" do
      create(:organization)

      ActsAsTenant.without_tenant do
        expect {
          expect {
            Rake::Task["fixflow:create_admin"].execute(
              email: "second@example.com", password: "password123", org_name: "Second Org"
            )
          }.to raise_error(SystemExit)
        }.not_to change { [Organization.count, User.count] }
      end
    end
  end

  describe "fixflow:demo_data" do
    after { ENV.delete("CONFIRM") }

    it "loads the demo company and lists the demo logins" do
      expect {
        expect { Rake::Task["fixflow:demo_data"].execute }.to output(/admin@demo\.com/).to_stdout
      }.to change(Organization, :count).by(1)
    end

    it "aborts without changing anything when a real company exists" do
      create(:organization, subdomain: "acme")

      expect {
        expect { Rake::Task["fixflow:demo_data"].execute }.to raise_error(SystemExit)
      }.not_to change { [Organization.count, User.count] }
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

  describe "fixflow:sample_data and fixflow:remove_sample_data" do
    def run(task) = Rake::Task["fixflow:#{task}"].tap(&:reenable).invoke

    let(:org) { create(:organization) }

    before { create(:user, :admin, organization: org) }

    it "adds the sample data to the company, then takes it out again" do
      expect {
        run("sample_data")
      }.to output(/Sample data loaded: 3 places, 5 assets, 4 parts, 1 PM schedule, and 9 work orders\./).to_stdout
      expect(org.assets.count).to eq(5)

      expect {
        run("remove_sample_data")
      }.to output(/Removed: 3 places, 5 assets, 4 parts, 1 PM schedule, and 9 work orders\./).to_stdout
      expect(org.assets.count).to eq(0)
    end

    it "says so, and stops, when it is already loaded" do
      run("sample_data")

      expect { run("sample_data") }.to raise_error(SystemExit).and output(/already loaded/).to_stderr
    end

    it "says so when there is no company yet" do
      Organization.destroy_all

      expect { run("sample_data") }.to raise_error(SystemExit).and output(/no company yet/).to_stderr
    end
  end
end
