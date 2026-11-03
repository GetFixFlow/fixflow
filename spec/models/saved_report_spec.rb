require "rails_helper"

RSpec.describe SavedReport, type: :model do
  let(:org)     { create(:organization) }
  let(:manager) { create(:user, :manager, organization: org) }

  def build_report(**attrs) = build(:saved_report, organization: org, user: manager, **attrs)

  describe ".range_for" do
    it "means the whole days before today for the last N days" do
      today = Date.new(2026, 11, 4)

      expect(described_class.range_for("last_7_days", today)).to eq([Date.new(2026, 10, 28), Date.new(2026, 11, 3)])
      expect(described_class.range_for("last_30_days", today)).to eq([Date.new(2026, 10, 5), Date.new(2026, 11, 3)])
      expect(described_class.range_for("last_90_days", today)).to eq([Date.new(2026, 8, 6), Date.new(2026, 11, 3)])
    end

    it "means the month so far for this month, even on the 1st" do
      expect(described_class.range_for("this_month", Date.new(2026, 11, 18))).to eq([Date.new(2026, 11, 1), Date.new(2026, 11, 18)])
      expect(described_class.range_for("this_month", Date.new(2026, 11, 1))).to eq([Date.new(2026, 11, 1), Date.new(2026, 11, 1)])
    end

    it "means the whole of the month before for last month, across a year end and in a short month" do
      expect(described_class.range_for("last_month", Date.new(2026, 11, 18))).to eq([Date.new(2026, 10, 1), Date.new(2026, 10, 31)])
      expect(described_class.range_for("last_month", Date.new(2027, 1, 5))).to eq([Date.new(2026, 12, 1), Date.new(2026, 12, 31)])
      expect(described_class.range_for("last_month", Date.new(2027, 3, 31))).to eq([Date.new(2027, 2, 1), Date.new(2027, 2, 28)])
    end

    it "refuses a period it does not know" do
      expect { described_class.range_for("yesterday", Date.current) }.to raise_error(ArgumentError)
    end
  end

  describe "#filters=" do
    it "keeps the Filters panel's lists in the form the reports read, and nothing else" do
      saved = build_report(filters: { "location_ids" => ["3", 3, "x", 4], "asset_ids" => "7", "priorities" => %w[high urgent high],
                                      "sources" => %w[pm bogus], "user_ids" => [], "evil" => "1", "from" => "2020-01-01" })

      expect(saved.filters).to eq("location_ids" => [3, 4], "asset_ids" => [7], "priorities" => ["high"], "sources" => ["pm"])
    end

    it "takes parameters from a request, and treats anything else as no filters" do
      expect(build_report(filters: ActionController::Parameters.new("asset_ids" => ["5"]).permit!).filters).to eq("asset_ids" => [5])
      expect(build_report(filters: "asset_ids").filters).to eq({})
    end
  end

  describe "validations" do
    it "wants a name, once for each report in a company, whatever the case" do
      create(:saved_report, organization: org, user: manager, name: "Monthly review")

      expect(build_report(name: "")).not_to be_valid
      expect(build_report(name: "monthly   REVIEW")).not_to be_valid
      expect(build_report(name: "Monthly review", report: "asset_health")).to be_valid
      expect(build(:saved_report, name: "Monthly review")).to be_valid
      expect(build_report(name: "x" * 81)).not_to be_valid
    end

    it "takes only the reports that can make a PDF, and the periods it knows" do
      expect(build_report(report: "downtime")).not_to be_valid
      expect(build_report(period: "last_year")).not_to be_valid
      SavedReport::REPORTS.each_key { |report| expect(build_report(report: report)).to be_valid }
    end

    it "takes a weekday from 0 to 6, or none" do
      expect(build_report(send_on: nil)).to be_valid
      expect(build_report(send_on: 7, recipient_ids: [manager.id])).not_to be_valid
      expect(build_report(send_on: -1, recipient_ids: [manager.id])).not_to be_valid
    end

    it "wants somebody to email when it is to be emailed" do
      expect(build_report(send_on: 1, recipient_ids: [])).not_to be_valid
      expect(build_report(send_on: 1, recipient_ids: [manager.id])).to be_valid
    end

    it "lets only managers and administrators of the company be chosen, because reports show what work cost" do
      technician = create(:user, organization: org)
      outsider = create(:user, :manager)
      gone = create(:user, :manager, organization: org, deactivated_at: 1.day.ago)

      [technician, outsider, gone].each do |person|
        saved = build_report(send_on: 1, recipient_ids: [manager.id, person.id])
        expect(saved).not_to be_valid
        expect(saved.errors[:recipient_ids].first).to include("managers and administrators")
      end
      expect(build_report(send_on: 1, recipient_ids: [manager.id, create(:user, :admin, organization: org).id])).to be_valid
    end

    it "is limited to 20 recipients" do
      many = create_list(:user, 21, :manager, organization: org).map(&:id)

      expect(build_report(send_on: 1, recipient_ids: many)).not_to be_valid
      expect(build_report(send_on: 1, recipient_ids: many.first(20))).to be_valid
    end
  end

  describe "#people_to_email" do
    let(:other) { create(:user, :manager, organization: org) }
    let(:saved) { create(:saved_report, organization: org, user: manager, send_on: 1, recipient_ids: [manager.id, other.id]) }

    it "is the people chosen" do
      expect(saved.people_to_email).to contain_exactly(manager, other)
    end

    it "leaves out someone who turned it off in Settings, Notifications" do
      other.update!(notification_preferences: { "rules" => { "report_scheduled" => { "email" => false } } })

      expect(saved.people_to_email).to contain_exactly(manager)
    end

    it "leaves out someone who is no longer a manager, or has been deactivated" do
      saved
      other.update!(role: "technician")
      expect(saved.reload.people_to_email).to contain_exactly(manager)

      manager.update!(deactivated_at: Time.current)
      expect(saved.reload.people_to_email).to be_empty
    end
  end

  describe "#query_for" do
    it "gives the dates of the period and the filters, as the report asks for them" do
      saved = build_report(period: "last_7_days", filters: { "priorities" => ["high"], "asset_ids" => [2] })

      expect(saved.query_for(Date.new(2026, 11,
4))).to eq("from" => "2026-10-28", "to" => "2026-11-03", "asset_ids" => [2], "priorities" => ["high"])
    end
  end

  it "is written to the audit log when it is made and changed, but the job's bookkeeping is not" do
    saved = create(:saved_report, organization: org, user: manager)
    saved.update!(name: "Renamed")
    saved.update!(last_sent_on: Date.current, last_sent_at: Time.current, last_error: "x")

    lines = ActivityLog.where(resource_type: "SavedReport", resource_id: saved.id).order(:id).pluck(:action)
    expect(lines).to eq(%w[saved_report.created saved_report.updated])
  end
end
