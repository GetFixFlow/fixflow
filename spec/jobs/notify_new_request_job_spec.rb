require "rails_helper"

RSpec.describe NotifyNewRequestJob, type: :job do
  let(:organization) { create(:organization) }
  let!(:manager1)    { create(:user, organization: organization, role: "manager") }
  let!(:manager2)    { create(:user, organization: organization, role: "manager") }

  describe "#perform" do
    let(:work_order) { create(:work_order, :public_request, organization: organization) }

    it "enqueues new_request mail for every manager" do
      expect {
        described_class.perform_now(work_order.id)
      }.to have_enqueued_mail(WorkOrderMailer, :new_request).twice
    end

    it "does nothing when work order does not exist" do
      expect { described_class.perform_now(0) }.not_to raise_error
    end
  end
end
