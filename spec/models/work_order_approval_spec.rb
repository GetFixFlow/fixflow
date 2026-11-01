require "rails_helper"

RSpec.describe WorkOrderApproval do
  include ActiveJob::TestHelper

  let(:org)  { create(:organization) }
  let(:tech) { create(:user, organization: org) }
  let(:boss) { create(:user, :manager, organization: org) }
  let(:order) { create(:work_order, :assigned, organization: org, assignee: tech, estimated_hours: 4) }

  def settings(values)
    org.assign_company_settings(values)
    org.save!
  end

  describe "#expected_cost" do
    before { settings("labor_rate" => 50) }

    it "is the parts, the vendor's charge and the estimated labor at the company's rate" do
      order.update!(parts_cost: 30, vendor_cost: 120)

      expect(order.expected_cost).to eq(350) # 30 + 120 + 4 h x 50
    end

    it "prices the labor at the assignee's own rate when they have one" do
      tech.update!(hourly_rate: 80)

      expect(order.expected_cost).to eq(320)
    end

    it "uses the hours recorded instead of the estimate once there are some" do
      order.update!(actual_hours: 6)

      expect(order.expected_cost).to eq(300) # not the 200 of the estimate
    end

    it "is nothing for work with no estimate, no parts and no charge" do
      expect(create(:work_order, organization: org).expected_cost).to eq(0)
    end
  end

  describe "#approval_needed?" do
    before { settings("labor_rate" => 50) }

    it "is never when there is no limit" do
      order.update!(vendor_cost: 1_000_000)

      expect(order.approval_needed?).to be(false)
    end

    it "is when the cost is over the limit, but not when it is exactly the limit" do
      settings("approval_limit" => 200)
      expect(order.approval_needed?).to be(false) # 4 h x 50 = 200

      order.update!(vendor_cost: 0.01)
      expect(order.approval_needed?).to be(true)
    end

    it "is not once approved at this cost" do
      settings("approval_limit" => 100)
      order.approve!(by: boss)

      expect(order.approval_needed?).to be(false)
    end

    it "is again when the cost grows past what was approved, but not while it stays within it" do
      settings("approval_limit" => 100)
      order.approve!(by: boss)

      order.update!(vendor_cost: 40)
      expect(order.approval_needed?).to be(true)

      order.update!(vendor_cost: 0, parts_cost: 0)
      expect(order.approval_needed?).to be(false)
    end

    it "counts the company's limit as it is now, not as it was" do
      settings("approval_limit" => 100)
      expect(order.approval_needed?).to be(true)

      settings("approval_limit" => 500)
      expect(order.reload.approval_needed?).to be(false)
    end
  end

  describe "#approvable_by?" do
    it "is for managers and administrators, other than the person doing the work" do
      expect(order.approvable_by?(boss)).to be(true)
      expect(order.approvable_by?(create(:user, :admin, organization: org))).to be(true)
      expect(order.approvable_by?(tech)).to be(false)
      expect(order.approvable_by?(create(:user, organization: org))).to be(false) # a technician who is not doing it either
      expect(create(:work_order, :assigned, organization: org, assignee: boss).approvable_by?(boss)).to be(false)
    end
  end

  describe "#approve!" do
    before { settings("labor_rate" => 50, "approval_limit" => 100) }

    it "keeps who approved, when, and the cost they approved, and forgets that it was asked for" do
      order.update!(approval_requested_at: 1.hour.ago)

      order.approve!(by: boss)

      expect(order.reload).to have_attributes(approved_by: boss, approved_cost: 200, approval_requested_at: nil)
      expect(order.approved_at).to be_within(5.seconds).of(Time.current)
    end

    it "is logged" do
      order.approve!(by: boss)

      expect(ActivityLog.where(action: "work_order.approved", resource_id: order.id)).to exist
    end
  end

  describe "#request_approval!" do
    before { settings("labor_rate" => 50, "approval_limit" => 100) }

    it "tells the managers once, however often it is asked" do
      expect { 3.times { order.request_approval! } }.to have_enqueued_job(ApprovalRequestedJob).with(order.id).once
      expect(order.reload.approval_requested_at).to be_present
    end

    it "asks again after an approval, if the cost has grown past it" do
      order.request_approval!
      order.approve!(by: boss)
      order.update!(vendor_cost: 500)

      expect { order.request_approval! }.to have_enqueued_job(ApprovalRequestedJob)
    end
  end
end
