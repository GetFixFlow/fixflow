require "rails_helper"

RSpec.describe PmSchedulerJob, type: :job do
  let(:organization) { create(:organization) }
  let(:asset)        { create(:asset, organization: organization) }

  describe "#perform" do
    context "with due active PMs" do
      let!(:due_pm) do
        create(:preventive_maintenance, :active_pm,
          organization: organization, asset: asset,
          next_due_at: Time.current)
      end
      let!(:future_pm) do
        create(:preventive_maintenance, :active_pm,
          organization: organization, asset: asset,
          next_due_at: 3.days.from_now)
      end

      it "generates work orders for due PMs" do
        expect {
          described_class.perform_now
        }.to change(WorkOrder, :count).by(1)
      end

      it "does not generate for PMs not yet due" do
        described_class.perform_now
        expect(WorkOrder.where(preventive_maintenance: future_pm)).to be_empty
      end

      it "increments times_generated on the PM" do
        expect { described_class.perform_now }.to change { due_pm.reload.times_generated }.by(1)
      end
    end

    context "with an existing open work order" do
      let!(:due_pm) do
        create(:preventive_maintenance, :active_pm,
          organization: organization, asset: asset,
          next_due_at: Time.current)
      end

      before do
        create(:work_order, organization: organization,
          preventive_maintenance: due_pm, status: "open")
      end

      it "skips generation when an open work order already exists" do
        expect {
          described_class.perform_now
        }.not_to change(WorkOrder, :count)
      end
    end

    context "with a paused PM" do
      let!(:paused_pm) do
        create(:preventive_maintenance, :paused_pm,
          organization: organization, asset: asset,
          next_due_at: Time.current)
      end

      it "skips generation for paused PMs" do
        expect {
          described_class.perform_now
        }.not_to change(WorkOrder, :count)
      end
    end

    context "when one PM raises an error" do
      let!(:due_pm1) do
        create(:preventive_maintenance, :active_pm,
          organization: organization, asset: asset,
          next_due_at: Time.current)
      end
      let!(:due_pm2) do
        create(:preventive_maintenance, :active_pm,
          organization: organization, asset: asset,
          next_due_at: Time.current)
      end

      it "continues processing other PMs despite individual failures" do
        call_count = 0
        allow(PmSchedulerService).to receive(:should_generate?).and_return(true)
        allow(PmSchedulerService).to receive(:generate_work_order) do
          call_count += 1
          raise "DB error" if call_count == 1
        end

        expect { described_class.perform_now }.not_to raise_error
        expect(call_count).to eq(2)
      end
    end

    context "idempotency" do
      let!(:due_pm) do
        create(:preventive_maintenance, :active_pm,
          organization: organization, asset: asset,
          next_due_at: Time.current)
      end

      it "does not double-generate when run twice back-to-back" do
        described_class.perform_now
        expect { described_class.perform_now }.not_to change(WorkOrder, :count)
      end
    end
  end
end
