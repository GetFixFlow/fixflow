require "rails_helper"

RSpec.describe NotifyAssigneeJob, type: :job do
  let(:organization) { create(:organization) }
  let(:technician)   { create(:user, organization: organization, role: "technician") }

  describe "#perform" do
    let(:work_order) { create(:work_order, :assigned, organization: organization, assignee: technician) }

    it "delivers the assigned email" do
      expect {
        described_class.perform_now(work_order.id)
      }.to have_enqueued_mail(WorkOrderMailer, :assigned)
    end

    it "does nothing when work order does not exist" do
      expect { described_class.perform_now(0) }.not_to raise_error
    end

    it "does nothing when work order has no assignee" do
      wo = create(:work_order, organization: organization)
      expect { described_class.perform_now(wo.id) }.not_to raise_error
    end
  end
end
