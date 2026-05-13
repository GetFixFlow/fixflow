require "rails_helper"

RSpec.describe PmSchedulerService do
  let(:organization) { create(:organization) }
  let(:asset)        { create(:asset, organization: organization) }
  let(:technician)   { create(:user, organization: organization, role: "technician") }

  let(:base_template) do
    {
      "title"       => "Oil Change - {asset_name}",
      "description" => "Lubricate all moving parts on {asset_name}",
      "checklist"   => [
        { "step" => 1, "instruction" => "Drain old oil", "required" => true },
        { "step" => 2, "instruction" => "Replace filter",  "required" => true },
        { "step" => 3, "instruction" => "Add new oil",     "required" => false }
      ],
      "estimated_hours" => 1.5
    }
  end

  # ─── calculate_next_due ────────────────────────────────────────────────────

  describe ".calculate_next_due" do
    context "time_based with days unit" do
      let(:pm) do
        build(:preventive_maintenance,
          organization: organization, asset: asset,
          frequency_type: :time_based, frequency_value: 30, frequency_unit: "days",
          start_date: Date.today, last_run_at: nil)
      end

      it "returns start_date + frequency_value days when never run" do
        expected = pm.start_date + 30.days
        expect(described_class.calculate_next_due(pm).to_date).to eq(expected)
      end

      it "returns last_run_at + 30 days when previously run" do
        pm.last_run_at = 5.days.ago
        expected = pm.last_run_at.to_date + 30.days
        expect(described_class.calculate_next_due(pm).to_date).to eq(expected)
      end
    end

    context "time_based with weeks unit" do
      let(:pm) do
        build(:preventive_maintenance,
          organization: organization, asset: asset,
          frequency_type: :time_based, frequency_value: 2, frequency_unit: "weeks",
          start_date: Date.today, last_run_at: 1.week.ago)
      end

      it "returns last_run_at + 2 weeks" do
        expected = pm.last_run_at.to_date + 2.weeks
        expect(described_class.calculate_next_due(pm).to_date).to eq(expected)
      end
    end

    context "time_based with months unit" do
      let(:pm) do
        build(:preventive_maintenance,
          organization: organization, asset: asset,
          frequency_type: :time_based, frequency_value: 3, frequency_unit: "months",
          start_date: Date.today, last_run_at: 1.month.ago)
      end

      it "returns last_run_at + 3 months" do
        expected = pm.last_run_at.to_date + 3.months
        expect(described_class.calculate_next_due(pm).to_date).to eq(expected)
      end
    end

    context "meter_based" do
      let(:pm) do
        build(:preventive_maintenance, :meter_based_pm,
          organization: organization, asset: asset)
      end

      it "returns nil (not calculable from schedule)" do
        expect(described_class.calculate_next_due(pm)).to be_nil
      end
    end

    context "condition_based" do
      let(:pm) do
        build(:preventive_maintenance,
          organization: organization, asset: asset,
          frequency_type: :condition_based)
      end

      it "returns nil" do
        expect(described_class.calculate_next_due(pm)).to be_nil
      end
    end
  end

  # ─── should_generate? ─────────────────────────────────────────────────────

  describe ".should_generate?" do
    let(:pm) do
      create(:preventive_maintenance, :active_pm,
        organization: organization, asset: asset, template: base_template)
    end

    it "returns true when PM is active and due" do
      pm.update_column(:next_due_at, Time.current)
      expect(described_class.should_generate?(pm)).to be true
    end

    it "returns false when PM is paused" do
      pm.update_column(:status, PreventiveMaintenance.statuses[:paused])
      expect(described_class.should_generate?(pm)).to be false
    end

    it "returns false when next_due_at is nil" do
      pm.update_column(:next_due_at, nil)
      expect(described_class.should_generate?(pm)).to be false
    end

    it "returns false when next_due_at is more than 24 hours away" do
      pm.update_column(:next_due_at, 2.days.from_now)
      expect(described_class.should_generate?(pm)).to be false
    end

    it "returns false when end_date has passed" do
      pm.update_columns(next_due_at: Time.current, end_date: 1.day.ago)
      expect(described_class.should_generate?(pm)).to be false
    end

    it "returns false when an open work order already exists for this PM" do
      pm.update_column(:next_due_at, Time.current)
      create(:work_order, organization: organization, preventive_maintenance: pm, status: "open")
      expect(described_class.should_generate?(pm)).to be false
    end

    it "returns true even if a completed work order exists" do
      pm.update_column(:next_due_at, Time.current)
      create(:work_order, :completed, organization: organization, preventive_maintenance: pm)
      expect(described_class.should_generate?(pm)).to be true
    end
  end

  # ─── generate_work_order ──────────────────────────────────────────────────

  describe ".generate_work_order" do
    let(:pm) do
      create(:preventive_maintenance, :active_pm,
        organization: organization, asset: asset,
        assigned_to: technician,
        template: base_template)
    end

    it "creates a WorkOrder from the PM template" do
      expect { described_class.generate_work_order(pm) }.to change(WorkOrder, :count).by(1)
    end

    it "substitutes {asset_name} in the title" do
      wo = described_class.generate_work_order(pm)
      expect(wo.title).to include(asset.name)
      expect(wo.title).not_to include("{asset_name}")
    end

    it "sets the assignee from the PM" do
      wo = described_class.generate_work_order(pm)
      expect(wo.assignee).to eq(technician)
    end

    it "sets the priority from the PM" do
      pm.update_column(:priority, PreventiveMaintenance.priorities[:critical])
      wo = described_class.generate_work_order(pm)
      expect(wo.priority).to eq("critical")
    end

    it "creates a PmExecution record" do
      expect { described_class.generate_work_order(pm) }.to change(PmExecution, :count).by(1)
      exec = PmExecution.last
      expect(exec.status).to eq("generated")
      expect(exec.work_order).to be_present
    end

    it "increments pm.times_generated" do
      expect { described_class.generate_work_order(pm) }.to change { pm.reload.times_generated }.by(1)
    end

    it "updates pm.last_run_at" do
      described_class.generate_work_order(pm)
      expect(pm.reload.last_run_at).to be_within(5.seconds).of(Time.current)
    end

    it "builds the checklist from the template" do
      wo = described_class.generate_work_order(pm)
      expect(wo.checklist).to be_an(Array)
      expect(wo.checklist.first).to include("instruction", "required", "completed")
    end

    it "links the work order to the PM" do
      wo = described_class.generate_work_order(pm)
      expect(wo.preventive_maintenance).to eq(pm)
    end
  end

  # ─── preview_schedule ─────────────────────────────────────────────────────

  describe ".preview_schedule" do
    let(:pm) do
      create(:preventive_maintenance,
        organization: organization, asset: asset,
        frequency_type: :time_based, frequency_value: 30, frequency_unit: "days",
        next_due_at: Date.today.to_datetime, template: base_template)
    end

    it "returns an array of 12 dates" do
      dates = described_class.preview_schedule(pm, count: 12)
      expect(dates.size).to eq(12)
    end

    it "spaces dates by the frequency interval" do
      dates = described_class.preview_schedule(pm, count: 3)
      gap = (dates[1].to_date - dates[0].to_date).to_i
      expect(gap).to eq(30)
    end

    it "returns empty array when next_due_at is nil" do
      pm.update_column(:next_due_at, nil)
      expect(described_class.preview_schedule(pm)).to eq([])
    end

    it "stops before end_date" do
      pm.update_columns(end_date: 40.days.from_now)
      dates = described_class.preview_schedule(pm, count: 12)
      expect(dates.size).to be < 12
      expect(dates.last.to_date).to be <= pm.end_date
    end
  end
end
