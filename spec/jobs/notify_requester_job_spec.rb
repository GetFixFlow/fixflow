require "rails_helper"

RSpec.describe NotifyRequesterJob, type: :job do
  let(:organization) { create(:organization) }
  let(:requester)    { create(:user, organization: organization) }

  describe "#perform" do
    it "sends verified mail for a User requester" do
      work_order = create(:work_order, :verified, organization: organization, requester: requester)
      expect {
        described_class.perform_now(work_order.id)
      }.to have_enqueued_mail(WorkOrderMailer, :verified)
    end

    it "sends verified_public mail for an email-only requester" do
      work_order = create(:work_order, :verified, :public_request, organization: organization, requester: nil)
      expect {
        described_class.perform_now(work_order.id)
      }.to have_enqueued_mail(WorkOrderMailer, :verified_public)
    end

    it "does nothing when work order does not exist" do
      expect { described_class.perform_now(0) }.not_to raise_error
    end
  end
end
