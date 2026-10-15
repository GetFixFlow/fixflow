require "rails_helper"

RSpec.describe WorkOrder do
  describe "labor cost" do
    let(:org)        { create(:organization) }
    let(:technician) { create(:user, organization: org, hourly_rate: nil) }
    let(:work_order) { create(:work_order, :in_progress, organization: org, assignee: technician) }

    def use_company_rate(rate)
      org.assign_company_settings("labor_rate" => rate)
      org.save!
    end

    it "is hours times the assignee's own rate, which is kept with it" do
      technician.update!(hourly_rate: 45)

      work_order.update!(actual_hours: 2.5)

      expect(work_order).to have_attributes(labor_rate: 45, labor_cost: 112.5)
    end

    it "uses the company's default rate when the assignee has none" do
      use_company_rate(30)

      work_order.update!(actual_hours: 3)

      expect(work_order).to have_attributes(labor_rate: 30, labor_cost: 90)
    end

    it "prefers the person's rate over the company's" do
      use_company_rate(30)
      technician.update!(hourly_rate: 50)

      work_order.update!(actual_hours: 1)

      expect(work_order.labor_cost).to eq(50)
    end

    it "is nothing when no rate has been set anywhere, rather than a made-up one" do
      work_order.update!(actual_hours: 4)

      expect(work_order).to have_attributes(labor_rate: 0, labor_cost: 0)
    end

    it "rounds to cents" do
      technician.update!(hourly_rate: 33.33)

      work_order.update!(actual_hours: 1.33)

      expect(work_order.labor_cost).to eq(44.33)
    end

    it "works out again when the hours are corrected" do
      technician.update!(hourly_rate: 40)
      work_order.update!(actual_hours: 2)

      work_order.update!(actual_hours: 3)

      expect(work_order.labor_cost).to eq(120)
    end

    it "does not rewrite work already priced when rates change later" do
      technician.update!(hourly_rate: 40)
      work_order.update!(actual_hours: 2)

      technician.update!(hourly_rate: 100)
      use_company_rate(100)
      work_order.update!(title: "Renamed")

      expect(work_order.reload).to have_attributes(labor_rate: 40, labor_cost: 80)
    end

    it "clears the cost when the hours are removed" do
      technician.update!(hourly_rate: 40)
      work_order.update!(actual_hours: 2)

      work_order.update!(actual_hours: nil)

      expect(work_order).to have_attributes(labor_rate: nil, labor_cost: 0)
    end

    it "leaves a work order with no hours alone" do
      expect(work_order).to have_attributes(labor_cost: 0, labor_rate: nil)
    end

    it "refuses negative or absurd hours" do
      expect(build(:work_order, organization: org, actual_hours: -1)).not_to be_valid
      expect(build(:work_order, organization: org, actual_hours: 10_000)).not_to be_valid
    end

    it "prices work that was completed before rates existed the next time it is saved with hours" do
      technician.update!(hourly_rate: 40)
      work_order.update_columns(actual_hours: 2, labor_rate: nil, labor_cost: 0) # rubocop:disable Rails/SkipsModelValidations -- as old data was

      work_order.update!(title: "Touched")

      expect(work_order.reload).to have_attributes(labor_rate: 40, labor_cost: 80)
    end
  end
end
