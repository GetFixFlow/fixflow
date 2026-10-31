require "rails_helper"

RSpec.describe TeamSchedule do
  let(:org)   { create(:organization) }
  let(:ann)   { create(:user, organization: org, first_name: "Ann", last_name: "Ames") }
  let(:ben)   { create(:user, organization: org, first_name: "Ben", last_name: "Bell") }
  let(:monday) { Date.new(2026, 10, 12) }
  let(:week)   { described_class.new(org, from: monday, to: monday + 6, today: monday + 2).call }

  def job(due, assignee: ann, hours: 2, **attrs)
    create(:work_order, organization: org, assignee: assignee, status: assignee ? "assigned" : "open",
                        due_date: due, estimated_hours: hours, **attrs)
  end

  def tech(name) = week[:technicians].find { |t| t[:name].start_with?(name) }

  def day(row, date) = row[:days].find { |d| d[:date] == date.iso8601 }

  describe "the days" do
    it "gives each day the hours it can hold: the company's work hours on work days, none on a day off" do
      expect(week[:days].map { |d| [d[:date], d[:working], d[:hours]] }).to eq(
        (0..6).map { |i| [(monday + i).iso8601, i < 5, i < 5 ? 9.0 : 0.0] }
      )
    end

    it "follows the company's own hours, days and holidays" do
      org.assign_company_settings("work_hours" => { "start" => "09:00", "end" => "13:30" }, "work_days" => [1, 2, 3, 4],
                                  "holidays" => [{ "date" => "2026-10-13", "name" => "Founders' Day" }])
      org.save!

      expect(week[:days][1]).to include(working: false, holiday: "Founders' Day", hours: 0.0)
      expect(week[:days][4]).to include(working: false, holiday: nil, hours: 0.0)
      expect(week[:days][0]).to include(working: true, hours: 4.5)
    end
  end

  describe "the load" do
    it "adds up the hours of the work due each day, for each person" do
      job(monday.in_time_zone + 9.hours, hours: 3)
      job(monday.in_time_zone + 14.hours, hours: 2.5)
      job((monday + 1).in_time_zone + 9.hours, hours: 4)
      job(monday.in_time_zone + 9.hours, assignee: ben, hours: 1)

      expect(day(tech("Ann"), monday)).to include(count: 2, hours: 5.5, overloaded: false)
      expect(day(tech("Ann"), monday + 1)).to include(count: 1, hours: 4.0)
      expect(day(tech("Ben"), monday)).to include(count: 1, hours: 1.0)
      expect(day(tech("Ben"), monday + 3)).to include(count: 0, hours: 0.0, overloaded: false)
    end

    it "counts work with no estimate as an hour, and says that it was not an estimate" do
      job(monday.in_time_zone + 9.hours, hours: nil)

      expect(day(tech("Ann"), monday)).to include(hours: 1.0)
      expect(week[:work_orders].first).to include(hours: 1.0, estimated: false)
    end

    it "calls a day overloaded when it holds more than a working day, but not when it is just full" do
      job(monday.in_time_zone + 9.hours, hours: 9)
      job((monday + 1).in_time_zone + 9.hours, hours: 9.5)

      expect(day(tech("Ann"), monday)[:overloaded]).to be(false)
      expect(day(tech("Ann"), monday + 1)[:overloaded]).to be(true)
    end

    it "calls any work on a day off overloaded" do
      job((monday + 5).in_time_zone + 9.hours, hours: 0.5)

      expect(day(tech("Ann"), monday + 5)).to include(hours: 0.5, overloaded: true)
    end

    it "puts work on the day it is due in the company's time zone, not UTC's" do
      org.assign_company_settings("timezone" => "America/New_York")
      org.save!
      late_evening_in_new_york = Time.utc(2026, 10, 13, 2, 0) # 10 pm on Monday there

      Time.use_zone("America/New_York") do
        job(late_evening_in_new_york)
        result = described_class.new(org, from: monday, to: monday + 6, today: monday).call
        ann_row = result[:technicians].find { |t| t[:name].start_with?("Ann") }

        expect(day(ann_row, monday)[:count]).to eq(1)
        expect(day(ann_row, monday + 1)[:count]).to eq(0)
        expect(result[:work_orders].first[:day]).to eq(monday.iso8601)
      end
    end
  end

  describe "which work" do
    it "is the work still to do: not finished or cancelled work" do
      job(monday.in_time_zone + 9.hours, title: "Open job")
      done = job(monday.in_time_zone + 9.hours, title: "Done job")
      done.update_columns(status: "completed", completion_notes: "ok") # rubocop:disable Rails/SkipsModelValidations
      gone = job(monday.in_time_zone + 9.hours, title: "Gone job")
      gone.update_columns(status: "cancelled") # rubocop:disable Rails/SkipsModelValidations

      expect(week[:work_orders].pluck(:title)).to eq(["Open job"])
    end

    it "leaves out work due after the period, and other companies' work" do
      job((monday + 7).in_time_zone + 9.hours, title: "Next week")
      create(:work_order, organization: create(:organization), due_date: monday.in_time_zone + 9.hours)

      expect(week[:work_orders]).to be_empty
    end

    it "shows work nobody has yet in a row of its own" do
      ann
      job(monday.in_time_zone + 9.hours, assignee: nil, hours: 3, title: "Nobody's")

      expect(week[:unassigned][:name]).to be_nil
      expect(day(week[:unassigned], monday)).to include(count: 1, hours: 3.0)
      expect(week[:work_orders].first).to include(title: "Nobody's", assignee_id: nil)
      expect(day(tech("Ann"), monday)[:count]).to eq(0)
    end

    it "carries what is needed to show and move it" do
      asset = create(:asset, organization: org, name: "Pump 1")
      order = job(monday.in_time_zone + 9.hours, asset: asset, priority: "high")

      expect(week[:work_orders].first).to eq(
        id: order.id, work_order_number: order.work_order_number, title: order.title, priority: "high", status: "assigned",
        assignee_id: ann.id, day: monday.iso8601, hours: 2.0, estimated: true, asset: "Pump 1"
      )
    end
  end

  describe "work from before the period" do
    it "is counted on the person it is with, whether or not it is listed" do
      job(monday.in_time_zone - 3.days, hours: 2)
      job(monday.in_time_zone - 10.days, hours: nil)
      job(nil, hours: 4)
      job(monday.in_time_zone - 3.days, assignee: nil, hours: 5)

      expect(tech("Ann")[:earlier]).to eq(count: 3, hours: 7.0)
      expect(week[:unassigned][:earlier]).to eq(count: 1, hours: 5.0)
      expect(day(tech("Ann"), monday)[:count]).to eq(0)
    end

    it "lists the most recent of it and counts the rest, saying that the list was cut" do
      stub_const("TeamSchedule::EARLIER_LIMIT", 2)
      3.times { |i| job(monday.in_time_zone - (i + 1).days, title: "Late #{i}") }

      expect(week[:work_orders].pluck(:title)).to eq(["Late 0", "Late 1"])
      expect(tech("Ann")[:earlier][:count]).to eq(3)
      expect(week[:truncated]).to be(true)
    end

    it "does not let it crowd out the period's own work" do
      stub_const("TeamSchedule::EARLIER_LIMIT", 1)
      job(monday.in_time_zone - 3.days)
      job(monday.in_time_zone + 9.hours, title: "This week")

      expect(week[:work_orders].pluck(:title)).to include("This week")
    end
  end

  describe "the people" do
    it "lists every active technician, also those with nothing to do, by name" do
      ben
      ann
      create(:user, organization: org, first_name: "Cy", deactivated_at: 1.day.ago)
      create(:user, :requester, organization: org, first_name: "Req")

      expect(week[:technicians].pluck(:name)).to eq([ann.full_name, ben.full_name])
    end

    it "adds someone who is not a technician but has been given work" do
      boss = create(:user, :manager, organization: org, first_name: "Zed", last_name: "Boss")
      job(monday.in_time_zone + 9.hours, assignee: boss)

      expect(week[:technicians].map { |t| [t[:name], t[:role]] }).to include(["Zed Boss", "manager"])
    end

    it "does not list people of another company" do
      create(:user, organization: create(:organization), first_name: "Outsider")

      expect(week[:technicians].pluck(:name)).not_to include(a_string_matching(/Outsider/))
    end
  end

  it "says when it is cut short for a very full period" do
    stub_const("TeamSchedule::ROW_LIMIT", 1)
    2.times { job(monday.in_time_zone + 9.hours) }

    expect(week[:work_orders].size).to eq(1)
    expect(week[:truncated]).to be(true)
  end
end
