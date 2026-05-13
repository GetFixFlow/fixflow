require "rails_helper"

RSpec.describe AssetPolicy, type: :policy do
  let(:org)       { create(:organization) }
  let(:admin)     { create(:user, :admin,     organization: org) }
  let(:manager)   { create(:user, :manager,   organization: org) }
  let(:tech)      { create(:user,             organization: org) }
  let(:requester) { create(:user, :requester, organization: org) }
  let(:asset)     { ActsAsTenant.with_tenant(org) { create(:asset, organization: org) } }

  subject(:policy) { described_class }

  describe "create?" do
    it "allows manager"   { expect(policy.new(manager, asset).create?).to be true }
    it "forbids requester"{ expect(policy.new(requester, asset).create?).to be false }
    it "forbids tech"     { expect(policy.new(tech, asset).create?).to be false }
  end

  describe "destroy?" do
    it "allows admin"   { expect(policy.new(admin, asset).destroy?).to be true }
    it "forbids manager"{ expect(policy.new(manager, asset).destroy?).to be false }
  end

  describe "index? / show?" do
    it "allows technician" do
      expect(policy.new(tech, asset).index?).to be true
      expect(policy.new(tech, asset).show?).to be true
    end

    it "forbids requester" do
      expect(policy.new(requester, asset).index?).to be false
    end
  end
end
