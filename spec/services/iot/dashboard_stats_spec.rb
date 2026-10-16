require "rails_helper"

RSpec.describe Iot::DashboardStats do
  let(:org)   { create(:organization) }
  let(:other) { create(:organization) }
  let(:asset) { create(:asset, organization: org) }

  # The service is not tied to a request: it must keep to the company it is given even where no company is "current".
  def stats = ActsAsTenant.without_tenant { described_class.new(org).call }

  before do
    other_asset = create(:asset, organization: other)
    other_rule = create(:iot_rule, asset: other_asset, organization: other, wo_priority: :critical, last_triggered_at: 1.minute.ago)
    reading = create(:sensor_reading, asset: other_asset, organization: other)
    create(:iot_alert, iot_rule: other_rule, asset: other_asset, sensor_reading: reading)
    create(:sensor_reading, asset: asset, organization: org, recorded_at: 1.minute.ago)
  end

  it "counts only the company's own readings, alerts and rules" do
    expect(stats).to include(
      readings_per_hour: 1, monitored_assets: 1, open_alerts: 0, critical_alerts: 0, active_rules: 0, triggered_rules: 0,
      recent_alerts: []
    )
    expect(stats[:asset_status].pluck(:asset_id)).to eq([asset.id])
    expect(stats[:hourly_readings].sum { |hour| hour[:count] }).to eq(1)
    expect(stats[:hourly_readings].sum { |hour| hour[:alerts] }).to eq(0)
  end

  it "counts the company's own alerts when it has some" do
    rule = create(:iot_rule, asset: asset, organization: org, wo_priority: :high)
    create(:iot_alert, iot_rule: rule, asset: asset, sensor_reading: create(:sensor_reading, asset: asset, organization: org))

    expect(stats).to include(open_alerts: 1, high_alerts: 1, critical_alerts: 0)
    expect(stats[:recent_alerts].size).to eq(1)
  end
end
