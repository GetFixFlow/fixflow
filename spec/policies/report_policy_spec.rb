require "rails_helper"

RSpec.describe ReportPolicy, type: :policy do
  let(:org)       { create(:organization) }
  let(:admin)     { create(:user, :admin,     organization: org) }
  let(:manager)   { create(:user, :manager,   organization: org) }
  let(:tech)      { create(:user,             organization: org) }
  let(:requester) { create(:user, :requester, organization: org) }

  def policy_for(user) = described_class.new(user, nil)

  describe "export_pdf?" do
    it "allows manager"  { expect(policy_for(manager).export_pdf?).to be true }
    it "forbids tech"    { expect(policy_for(tech).export_pdf?).to be false }
  end

  describe "technician_performance?" do
    it "allows admin"    { expect(policy_for(admin).technician_performance?).to be true }
    it "forbids manager" { expect(policy_for(manager).technician_performance?).to be false }
  end

  describe "summary?" do
    it "allows technician"  { expect(policy_for(tech).summary?).to be true }
    it "forbids requester"  { expect(policy_for(requester).summary?).to be false }
  end
end
