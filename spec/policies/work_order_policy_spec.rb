require "rails_helper"

RSpec.describe WorkOrderPolicy, type: :policy do
  let(:org)       { create(:organization) }
  let(:admin)     { create(:user, :admin,     organization: org) }
  let(:manager)   { create(:user, :manager,   organization: org) }
  let(:tech)      { create(:user,             organization: org) }
  let(:requester) { create(:user, :requester, organization: org) }
  let(:work_order) do
    ActsAsTenant.with_tenant(org) { create(:work_order, organization: org, assignee: tech) }
  end

  subject(:policy) { described_class }

  describe "verify?" do
    it "allows manager to verify when not the assignee" do
      expect(policy.new(manager, work_order).verify?).to be true
    end

    it "forbids manager from verifying their own work order" do
      wo = ActsAsTenant.with_tenant(org) { create(:work_order, organization: org, assignee: manager) }
      expect(policy.new(manager, wo).verify?).to be false
    end

    it "forbids technician from verifying" do
      expect(policy.new(tech, work_order).verify?).to be false
    end
  end

  describe "destroy?" do
    it "allows manager to destroy" do
      expect(policy.new(manager, work_order).destroy?).to be true
    end

    it "forbids technician from destroying" do
      expect(policy.new(tech, work_order).destroy?).to be false
    end
  end

  describe "show?" do
    it "allows the assignee to view" do
      expect(policy.new(tech, work_order).show?).to be true
    end

    it "allows a manager to view any work order" do
      expect(policy.new(manager, work_order).show?).to be true
    end

    it "forbids a technician who is not the assignee" do
      other_tech = create(:user, organization: org)
      expect(policy.new(other_tech, work_order).show?).to be false
    end
  end

  describe "Scope" do
    before do
      ActsAsTenant.with_tenant(org) do
        create(:work_order, organization: org, assignee: tech)
        create(:work_order, organization: org, assignee: manager)
      end
    end

    it "returns all work orders for manager" do
      scope = ActsAsTenant.with_tenant(org) do
        described_class::Scope.new(manager, WorkOrder.all).resolve
      end
      expect(scope.count).to eq(WorkOrder.count)
    end

    it "returns only assigned work orders for technician" do
      scope = ActsAsTenant.with_tenant(org) do
        described_class::Scope.new(tech, WorkOrder.all).resolve
      end
      expect(scope.all? { |wo| wo.assignee_id == tech.id }).to be true
    end
  end
end
