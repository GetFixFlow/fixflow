require "rails_helper"

RSpec.describe PmDashboardService do
  let(:org)   { create(:organization) }
  let(:today) { Date.new(2026, 10, 14) }
  let(:site)  { create(:location, organization: org, name: "Main Plant") }
  let(:asset) { create(:asset, organization: org, location: site) }
  let(:pm)    { create(:preventive_maintenance, :active_pm, organization: org, asset: asset, name: "Monthly oil") }

  def dashboard(days: 90, organization: org)
    described_class.new(organization, days: days, today: today).call
  end

  def execution(status, date, schedule: pm, **attrs)
    create(:pm_execution, preventive_maintenance: schedule, status: status, scheduled_date: date,
                          skip_reason: (status == :skipped ? "No access" : nil), **attrs)
  end

  context "with no executions" do
    it "reports no data instead of inventing numbers" do
      result = dashboard

      expect(result).to include(overall_compliance: nil, compliance_change: nil, completed_this_month: 0,
                                scheduled_this_month: 0, avg_completion_hours: nil, avg_estimated_hours: nil)
      expect(result[:by_location]).to eq([])
      expect(result[:recent_activity]).to eq([])
      expect(result[:monthly_trend].size).to eq(6)
      expect(result[:monthly_trend].pluck(:compliance)).to all(be_nil)
    end
  end

  describe "compliance" do
    before do
      3.times { |i| execution(:completed, today - 10 - i) }
      execution(:skipped, today - 20)
      execution(:generated, today - 5)    # past its date and still not done: missed
      execution(:generated, today + 1)    # not due yet: left out
      execution(:pending, today)          # due today, not missed yet, but counts as due
    end

    it "is completed over everything that has come due" do
      # 3 completed, 1 skipped, 1 missed; the one due today is still open (not missed): 3 / 5
      expect(dashboard[:overall_compliance]).to eq(60.0)
    end

    it "does not count executions that are not due yet" do
      expect(dashboard(days: 7)[:overall_compliance]).to eq(0.0) # only the missed one falls inside the last 7 days
    end

    it "compares with the period before" do
      create_list(:pm_execution, 2, preventive_maintenance: pm, status: :completed, scheduled_date: today - 100)
      execution(:skipped, today - 95)

      # previous 90 days: 2 completed, 1 skipped = 66.7; current = 60.0
      expect(dashboard[:compliance_change]).to eq(-6.7)
    end

    it "is nil for the change when the earlier period has no data" do
      expect(dashboard[:compliance_change]).to be_nil
    end
  end

  describe "this month and hours" do
    it "counts this month's executions and averages hours of the completed ones" do
      done = create(:work_order, organization: org, asset: asset, status: "completed", completion_notes: "ok",
                                 actual_hours: 3, estimated_hours: 2)
      execution(:completed, today - 2, work_order: done)
      execution(:generated, today + 3)
      execution(:completed, today - 40)

      result = dashboard
      expect(result).to include(completed_this_month: 1, scheduled_this_month: 2)
      expect(result).to include(avg_completion_hours: 3.0, avg_estimated_hours: 2.0)
    end
  end

  describe "the six month trend" do
    it "lists the last six months in order, with the current month last" do
      execution(:completed, today - 2)
      execution(:skipped, Date.new(2026, 9, 10))
      trend = dashboard[:monthly_trend]

      expect(trend.pluck(:month)).to eq(%w[2026-05 2026-06 2026-07 2026-08 2026-09 2026-10])
      expect(trend.last).to include(completed: 1, missed: 0, compliance: 100.0)
      expect(trend[4]).to include(completed: 0, missed: 1, compliance: 0.0)
      expect(trend.first[:compliance]).to be_nil
    end
  end

  describe "by location" do
    it "groups by where the asset is, worst first, leaving out places with nothing due" do
      elsewhere = create(:preventive_maintenance, :active_pm, organization: org,
                         asset: create(:asset, organization: org, location: create(:location, organization: org, name: "Warehouse")))
      execution(:completed, today - 3)
      execution(:completed, today - 4)
      execution(:skipped, today - 5, schedule: elsewhere)

      expect(dashboard[:by_location]).to eq([
        { location_name: "Warehouse", compliance: 0.0, count: 1 },
        { location_name: "Main Plant", compliance: 100.0, count: 2 }
      ])
    end
  end

  describe "lists" do
    it "shows overdue schedules and what is due in the next week, active ones only" do
      overdue = create(:preventive_maintenance, :overdue_pm, organization: org, asset: asset, next_due_at: today.to_time - 2.days)
      create(:preventive_maintenance, :paused_pm, organization: org, asset: asset, next_due_at: today.to_time - 3.days)
      soon = create(:preventive_maintenance, organization: org, asset: asset, next_due_at: today.to_time + 3.days)

      travel_to(today.to_time) do
        result = described_class.new(org, days: 90, today: today).call
        expect(result[:overdue_pms].pluck(:id)).to contain_exactly(overdue.id)
        expect(result[:upcoming_week].map { |u| u[:pm][:id] }).to contain_exactly(soon.id)
        expect(result[:due_this_week]).to eq(1)
      end
    end
  end

  describe "recent activity" do
    it "describes what happened, newest first" do
      order = create(:work_order, organization: org, asset: asset, status: "completed", completion_notes: "ok",
                                  completed_at: 1.day.ago)
      execution(:completed, today - 2, work_order: order)
      execution(:skipped, today - 4)
      execution(:generated, today - 6)

      activity = dashboard[:recent_activity]
      expect(activity.pluck(:type)).to eq(%w[completed skipped missed])
      expect(activity.first).to include(pm_name: "Monthly oil", wo_number: order.work_order_number)
    end
  end

  it "only looks at the company it is asked about" do
    other_pm = create(:preventive_maintenance, :active_pm)
    create(:pm_execution, preventive_maintenance: other_pm, status: :completed, scheduled_date: today - 2)

    expect(dashboard[:overall_compliance]).to be_nil
    expect(dashboard[:recent_activity]).to eq([])
  end
end
