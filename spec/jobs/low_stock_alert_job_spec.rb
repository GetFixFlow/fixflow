require "rails_helper"

RSpec.describe LowStockAlertJob, type: :job do
  include ActiveJob::TestHelper

  let(:org)      { create(:organization) }
  let(:admin)   { create(:user, :admin, organization: org) }
  let(:manager) { create(:user, :manager, organization: org) }
  let(:gone)    { create(:user, :manager, organization: org, deactivated_at: 1.day.ago) }
  let(:tech)    { create(:user, organization: org) }
  let(:part)     { create(:part, organization: org) }

  before { [admin, manager, gone, tech] }

  it "emails the active managers and admins of the company, and nobody else" do
    other = create(:part, organization: create(:organization))
    create(:user, :manager, organization: other.organization)

    described_class.perform_now(part.id, "low")
    perform_enqueued_jobs

    recipients = ActionMailer::Base.deliveries.flat_map(&:to)
    expect(recipients).to contain_exactly(admin.email, manager.email)
  end

  it "does nothing for a part that no longer exists" do
    expect { described_class.perform_now(0, "low") }.not_to raise_error
  end
end
