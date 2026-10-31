require "rails_helper"

RSpec.describe DowntimeReport do
  let(:org)  { create(:organization) }
  let(:now)  { Time.utc(2026, 10, 16, 12, 0) }
  # Ten days: 240 hours.
  let(:from) { now - 10.days }

  around { |example| travel_to(now) { example.run } }

  def asset(name, **attrs) = create(:asset, organization: org, name: name, created_at: now - 40.days, **attrs)

  def down(asset, from_time, to_time, **attrs)
    create(:asset_downtime, organization: org, asset: asset, started_at: from_time, ended_at: to_time, **attrs)
  end

  def report(scope = org.assets, to: now) = described_class.new(scope, from: from, to: to, now: now).call

  def row(name) = report[:assets].find { |r| r[:name] == name }

  it "works out availability, stops, mean time between failures and mean time to restore for an asset" do
    pump = asset("Pump")
    down(pump, now - 8.days - 12.hours, now - 8.days)   # 12 hours
    down(pump, now - 4.days, now - 3.days)              # 24 hours

    expect(row("Pump")).to include(availability: 85.0, downtime_hours: 36.0, failures: 2, mtbf_hours: 102.0, mttr_hours: 18.0)
  end

  it "counts an asset that is down now up to this moment" do
    press = asset("Press", status: "down")
    press.downtimes.open.first.update!(started_at: now - 24.hours)

    expect(row("Press")).to include(availability: 90.0, downtime_hours: 24.0, failures: 1, mtbf_hours: 216.0, mttr_hours: 24.0,
                                    down_now: true)
  end

  it "counts only the time inside the period, and no stop for one that began before it" do
    old = asset("Old")
    down(old, from - 12.hours, from + 24.hours)

    expect(row("Old")).to include(availability: 90.0, downtime_hours: 24.0, failures: 0, mtbf_hours: nil, mttr_hours: nil)
  end

  it "gives an asset nothing for time before it was added, nor for time that has not come" do
    fan = create(:asset, organization: org, name: "Fan", created_at: now - 5.days)
    down(fan, now - 8.days, now - 4.days - 12.hours) # 12 of its hours are after it was added

    expect(row("Fan")).to include(availability: 90.0, downtime_hours: 12.0, failures: 0)
  end

  it "ends the period at now, even if the report was asked for a later date" do
    pump = asset("Pump")
    down(pump, now - 24.hours, now - 12.hours)

    result = report(to: now + 30.days)

    expect(result[:period]).to eq(from: "2026-10-06", to: "2026-10-16")
    expect(result[:assets].first).to include(availability: 95.0) # 12 of 240 hours
  end

  it "leaves out assets added after the period, decommissioned ones and those put away" do
    asset("Kept")
    create(:asset, organization: org, name: "Too new", created_at: now + 1.day)
    asset("Retired", status: "decommissioned")
    asset("Gone", discarded_at: 1.day.ago)

    expect(report[:assets].pluck(:name)).to eq(["Kept"])
  end

  it "adds the assets up into a summary, weighting by the hours each existed" do
    pump = asset("Pump")
    down(pump, now - 8.days - 12.hours, now - 8.days)
    down(pump, now - 4.days, now - 3.days)
    asset("Press", status: "down").downtimes.open.first.update!(started_at: now - 24.hours)
    create(:asset, organization: org, name: "Fan", created_at: now - 5.days)
    down(asset("Old"), from - 12.hours, from + 24.hours)

    expect(report[:summary]).to eq(availability: 90.0, downtime_hours: 84.0, failures: 3, mtbf_hours: 252.0, mttr_hours: 20.0,
                                   assets: 4, down_now: 1)
  end

  it "lists the least available first, then by name" do
    down(asset("Pump"), now - 4.days, now - 3.days)
    down(asset("Press"), now - 2.days, now - 1.day - 12.hours)
    asset("Fan")
    down(asset("Boiler"), now - 2.days, now - 1.day - 12.hours)

    expect(report[:assets].pluck(:name, :availability)).to eq([["Pump", 90.0], ["Boiler", 95.0], ["Press", 95.0], ["Fan", 100.0]])
  end

  it "says 100 when there is nothing to measure, and keeps other companies out" do
    create(:asset_downtime, started_at: now - 2.days, ended_at: now - 1.day)

    expect(report).to include(assets: [], summary: include(availability: 100.0, assets: 0, mtbf_hours: nil))
  end
end
