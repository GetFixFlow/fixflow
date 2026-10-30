require "rails_helper"

RSpec.describe "Maintenance that follows a meter" do
  let(:org)   { create(:organization) }
  let(:asset) { create(:asset, organization: org) }
  let(:meter) { create(:meter, organization: org, asset: asset, reading: 1000, unit: "km") }

  def make_pm(**attrs)
    create(:preventive_maintenance, :meter_based_pm, organization: org, asset: asset, meter: meter, frequency_value: 500, **attrs)
  end

  describe PreventiveMaintenance do
    it "counts from the meter's reading when it is made, in the meter's unit" do
      pm = make_pm(frequency_unit: "hours")

      expect(pm).to have_attributes(next_due_reading: 1500, frequency_unit: "km", next_due_at: nil)
    end

    it "counts from the last service when it is told when that was, and is due at once if that was long ago" do
      pm = make_pm(last_service_reading: 400)

      expect(pm.next_due_reading).to eq(900)
      expect(PmMeterService.due?(pm)).to be(true)
    end

    it "refuses a meter-based schedule with no meter, a meter of another asset, or a bad last service reading" do
      expect(build(:preventive_maintenance, organization: org, asset: asset, frequency_type: :meter_based,
        frequency_value: 5)).not_to be_valid
      other_asset_meter = create(:meter, organization: org)
      expect(build(:preventive_maintenance, organization: org, asset: asset, frequency_type: :meter_based, frequency_value: 5,
                   meter: other_asset_meter)).not_to be_valid
      expect(build(:preventive_maintenance, :meter_based_pm, organization: org, asset: asset, meter: meter,
                   last_service_reading: "soon")).not_to be_valid
    end

    it "moves the due reading when the interval changes, keeping the last service as the start" do
      pm = make_pm

      pm.update!(frequency_value: 800)

      expect(pm.reload.next_due_reading).to eq(1800)
    end

    it "forgets the meter when it becomes a schedule by date" do
      pm = make_pm

      pm.update!(frequency_type: :time_based, frequency_value: 30, frequency_unit: "days")

      expect(pm.reload).to have_attributes(meter_id: nil, next_due_reading: nil)
    end

    it "leaves a meter-based schedule made before meters existed alone: it can still be edited" do
      pm = create(:preventive_maintenance, organization: org, asset: asset, frequency_type: :time_based)
      pm.update_columns(frequency_type: 1, frequency_value: 500, frequency_unit: "hours") # rubocop:disable Rails/SkipsModelValidations

      expect(pm.reload.update(name: "Renamed")).to be(true)
    end
  end

  describe PmMeterService do
    it "is due when the meter reaches the due reading, not before" do
      pm = make_pm

      expect(described_class.due?(pm)).to be(false)
      meter.update!(reading: 1499.99)
      expect(described_class.due?(pm.reload)).to be(false)
      meter.update!(reading: 1500)
      expect(described_class.due?(pm.reload)).to be(true)
    end

    it "makes one work order, due in the company's default days, and no second while it is open" do
      pm = make_pm
      meter.update!(reading: 1600)

      expect { described_class.check(meter) }.to change(WorkOrder, :count).by(1)
      expect { described_class.check(meter) }.not_to change(WorkOrder, :count)

      expect(WorkOrder.last.due_date).to be_within(1.minute).of(org.default_due_days.days.from_now)
      expect(pm.reload).to have_attributes(times_generated: 1, last_run_at: be_present)
    end

    it "carries on from the fixed series, skipping the intervals that were passed" do
      pm = make_pm
      meter.update!(reading: 3200) # due at 1500, then 2000, 2500, 3000 were all passed

      described_class.check(meter)

      expect(pm.reload.next_due_reading).to eq(3500)
    end

    it "counts from now when a person triggers it before it is due" do
      pm = make_pm
      meter.update!(reading: 1200)

      PmSchedulerService.generate_work_order(pm)

      expect(pm.reload.next_due_reading).to eq(1700)
    end

    it "does nothing for a paused schedule, and makes none after its end date" do
      paused = make_pm(status: :paused)
      ended = make_pm(name: "Ended", end_date: Date.yesterday, start_date: 1.year.ago.to_date)
      meter.update!(reading: 5000)

      expect { described_class.check(meter) }.not_to change(WorkOrder, :count)
      expect([paused, ended].map { |pm| PmSchedulerService.should_generate?(pm) }).to eq([false, false])
    end

    it "does not stop the other schedules when one fails" do
      make_pm(name: "Fails")
      good = make_pm(name: "Works", frequency_value: 400)
      meter.update!(reading: 1600)
      allow(PmSchedulerService).to receive(:generate_work_order).and_wrap_original do |original, pm, **opts|
        raise "boom" if pm.name == "Fails"

        original.call(pm, **opts)
      end

      expect { described_class.check(meter) }.to change(WorkOrder, :count).by(1)
      expect(WorkOrder.last.preventive_maintenance_id).to eq(good.id)
    end
  end

  describe PmSchedulerJob do
    it "makes the work order of a meter-based schedule that was missed, and does not count the others as skipped" do
      pm = make_pm
      meter.update!(reading: 1700)

      expect { described_class.perform_now }.to change(WorkOrder, :count).by(1)
      expect(pm.reload.times_generated).to eq(1)
    end
  end
end
