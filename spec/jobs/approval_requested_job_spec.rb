require "rails_helper"

RSpec.describe ApprovalRequestedJob do
  include ActiveJob::TestHelper

  let(:org)      { create(:organization) }
  let!(:boss)    { create(:user, :manager, organization: org) }
  let!(:doing_it) { create(:user, :manager, organization: org) }
  let(:order) do
    create(:work_order, :assigned, organization: org, assignee: doing_it, vendor_cost: 900, approval_requested_at: Time.current)
  end

  before do
    org.assign_company_settings("approval_limit" => 100)
    org.save!
    ActionMailer::Base.deliveries.clear
  end

  def recipients
    perform_enqueued_jobs
    ActionMailer::Base.deliveries.flat_map(&:to)
  end

  it "tells the other managers, and not the manager who is doing the work, who cannot approve it" do
    described_class.perform_now(order.id)

    expect(recipients).to eq([boss.email])
  end

  it "posts to the company's chat" do
    expect(ChatNotifier).to receive(:post)
      .with(org, "wo_approval_needed", hash_including(title: "#{order.work_order_number} needs approval"))

    described_class.perform_now(order.id)
  end

  it "says nothing when it has been approved since it was asked for" do
    order.approve!(by: boss)

    described_class.perform_now(order.id)

    expect(recipients).to be_empty
  end

  it "says nothing when nobody asked" do
    order.update!(approval_requested_at: nil)

    described_class.perform_now(order.id)

    expect(recipients).to be_empty
  end

  it "says nothing about a work order that is gone" do
    expect { described_class.perform_now(0) }.not_to raise_error
  end
end
