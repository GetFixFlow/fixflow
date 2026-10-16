require "rails_helper"

RSpec.describe Iot::AlertNotificationJob, type: :job do
  let(:org)     { create(:organization) }
  let(:plant)   { create(:location, organization: org, name: "Plant") }
  let(:asset)   { create(:asset, organization: org, name: "Pump 3", location: plant) }
  let(:rule)    { create(:iot_rule, asset: asset, organization: org, name: "Pump too hot", wo_priority: :critical, unit: "°C") }
  let(:reading) { create(:sensor_reading, asset: asset, organization: org) }
  let(:alert)   { create(:iot_alert, iot_rule: rule, asset: asset, sensor_reading: reading) }

  it "tells the company's live feed about the alert, in the shape the alert list uses" do
    shown = { "id" => alert.id, "severity" => "critical", "rule_name" => "Pump too hot", "location_path" => "Plant",
              "message" => a_string_including("temperature above 85") }

    expect { described_class.perform_now(alert.id) }
      .to have_broadcasted_to("iot_alerts_org_#{org.id}").with(a_hash_including(alert: a_hash_including(shown)))
  end

  it "still tells the asset's own stream" do
    expect { described_class.perform_now(alert.id) }
      .to have_broadcasted_to("iot_channel_asset_#{asset.id}").with(a_hash_including(type: "alert", alert_id: alert.id))
  end

  it "does not tell another company's feed" do
    other = create(:organization)

    expect { described_class.perform_now(alert.id) }.not_to have_broadcasted_to("iot_alerts_org_#{other.id}")
  end

  it "does nothing for an alert that no longer exists" do
    expect { described_class.perform_now(0) }.not_to raise_error
  end
end
