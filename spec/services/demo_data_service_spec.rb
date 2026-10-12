require "rails_helper"

RSpec.describe DemoDataService do
  def production!
    allow(Rails).to receive(:env).and_return(ActiveSupport::StringInquirer.new("production"))
  end

  describe ".load!" do
    it "creates the demo company, its users and sample data on an empty install" do
      logins = described_class.load!

      expect(logins).to match_array(DemoDataService::DEMO_LOGINS)
      org = Organization.find_by!(subdomain: "demo")
      expect(org.users.pluck(:email)).to match_array(DemoDataService::DEMO_LOGINS)
      expect(org.users.find_by!(email: "admin@demo.com")).to be_admin
      expect(Asset.unscoped.where(organization: org)).not_to be_empty
      expect(WorkOrder.unscoped.where(organization: org)).not_to be_empty
      expect(PreventiveMaintenance.unscoped.where(organization: org)).not_to be_empty
    end

    it "can be run twice without duplicating anything" do
      described_class.load!

      expect { described_class.load! }.not_to change {
        [Organization.count, User.count, Asset.unscoped.count, WorkOrder.unscoped.count]
      }
    end

    it "makes the install count as set up, so public sign-up is closed" do
      described_class.load!
      expect(Organization.setup_complete?).to be true
    end

    it "refuses when a real company already exists and changes nothing" do
      create(:organization, subdomain: "acme")

      expect { described_class.load! }.to raise_error(DemoDataService::Refused, /already has a company/)
      expect(Organization.where(subdomain: "demo")).to be_empty
      expect(User.count).to eq(0)
    end

    context "in production" do
      before { production! }

      it "refuses without confirmation" do
        expect { described_class.load! }.to raise_error(DemoDataService::Refused, /CONFIRM=yes/)
        expect(Organization.count).to eq(0)
      end

      it "loads once confirmed" do
        expect { described_class.load!(confirmed: true) }.to change(Organization, :count).by(1)
      end
    end
  end
end
