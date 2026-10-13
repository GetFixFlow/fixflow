require "rails_helper"

RSpec.describe PmExecutionSync do
  let(:org)      { create(:organization) }
  let(:tech)     { create(:user, organization: org) }
  let(:pm)       { create(:preventive_maintenance, :active_pm, organization: org) }
  let(:work_order) { PmSchedulerService.generate_work_order(pm).tap { |wo| wo.update!(assignee: tech, status: "in_progress") } }
  let(:execution)  { PmExecution.find_by!(work_order_id: work_order.id) }

  def complete!(order)
    order.update!(completion_notes: "Replaced the belt and tested the drive")
    order.complete!
  end

  it "counts a PM as completed when its work order is completed" do
    expect(execution).to be_status_generated

    complete!(work_order)

    expect(execution.reload).to be_status_completed
    expect(pm.reload.times_completed).to eq(1)
  end

  it "takes the completion back when a manager sends the work order back" do
    complete!(work_order)
    work_order.reload.reject!

    expect(execution.reload).to be_status_generated
    expect(pm.reload.times_completed).to eq(0)
  end

  it "completes again after a rejection without double counting" do
    complete!(work_order)
    work_order.reload.reject!
    work_order.reload.complete!

    expect(execution.reload).to be_status_completed
    expect(pm.reload.times_completed).to eq(1)
  end

  it "counts a cancelled work order as a skipped PM, with the reason" do
    work_order.cancel!

    expect(execution.reload).to have_attributes(status: "skipped", skip_reason: "Work order cancelled")
    expect(pm.reload).to have_attributes(times_skipped: 1, times_completed: 0)
  end

  it "reverses a completion when the completed work order is cancelled" do
    complete!(work_order)
    work_order.reload.cancel!

    expect(execution.reload).to be_status_skipped
    expect(pm.reload).to have_attributes(times_completed: 0, times_skipped: 1)
  end

  it "ignores work orders that did not come from a PM" do
    manual = create(:work_order, :in_progress, organization: org, assignee: tech, completion_notes: "Fixed")

    expect { manual.complete! }.not_to raise_error
    expect(PmExecution.count).to eq(0)
  end

  it "never lets a count go below zero" do
    pm.update!(times_completed: 0)
    execution.update!(status: :completed)

    expect { described_class.reopened(work_order) }.not_to raise_error
    expect(pm.reload.times_completed).to eq(0)
  end
end
