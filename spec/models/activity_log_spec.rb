require "rails_helper"

RSpec.describe ActivityLog, type: :model do
  subject(:log) { build(:activity_log) }

  describe "associations" do
    it { is_expected.to belong_to(:organization) }
    it { is_expected.to belong_to(:user).optional }
  end

  describe "validations" do
    it { is_expected.to validate_presence_of(:action) }
  end

  describe "scopes" do
    let(:org) { create(:organization) }

    before do
      create(:activity_log, organization: org, action: "work_order.completed",
             resource_type: "WorkOrder", resource_id: 1,
             created_at: 2.days.ago)
      create(:activity_log, organization: org, action: "asset.updated",
             resource_type: "Asset", resource_id: 2,
             created_at: 1.day.ago)
    end

    describe ".recent" do
      it "returns logs in descending order by created_at" do
        logs = ActivityLog.where(organization: org).recent
        expect(logs.first.created_at).to be > logs.last.created_at
      end
    end

    describe ".by_action" do
      it "filters by action" do
        result = ActivityLog.where(organization: org).by_action("work_order.completed")
        expect(result.count).to eq(1)
        expect(result.first.action).to eq("work_order.completed")
      end
    end

    describe ".by_resource" do
      it "filters by resource_type" do
        result = ActivityLog.where(organization: org).by_resource("Asset")
        expect(result.count).to eq(1)
        expect(result.first.resource_type).to eq("Asset")
      end
    end

    describe ".for_resource" do
      it "filters by resource_type and resource_id" do
        result = ActivityLog.where(organization: org).for_resource("WorkOrder", 1)
        expect(result.count).to eq(1)
      end
    end

    describe ".since" do
      it "returns logs after the given time" do
        result = ActivityLog.where(organization: org).since(36.hours.ago)
        expect(result.count).to eq(1)
      end
    end

    describe ".until_time" do
      it "returns logs before the given time" do
        result = ActivityLog.where(organization: org).until_time(36.hours.ago)
        expect(result.count).to eq(1)
      end
    end
  end
end
