require "rails_helper"

RSpec.describe Iot::AlertNotificationJob, type: :job do
  let(:org)     { create(:organization) }
  let(:plant)   { create(:location, organization: org, name: "Plant") }
  let(:asset)   { create(:asset, organization: org, name: "Pump 3", location: plant) }
  let(:rule)    { create(:iot_rule, asset: asset, organization: org, name: "Pump too hot", wo_priority: :critical, unit: "°C") }
  let(:reading) { create(:sensor_reading, asset: asset, organization: org) }
  let(:alert)   { create(:iot_alert, iot_rule: rule, asset: asset, sensor_reading: reading) }

  it "also tells the feed of the site the asset is in, and of no site for an asset that is in none" do
    site = create(:location, organization: org, name: "North", location_type: "site")
    in_site = create(:asset, organization: org, location: create(:location, organization: org, parent: site, location_type: "building"))
    site_rule = create(:iot_rule, asset: in_site, organization: org)
    site_alert = create(:iot_alert, iot_rule: site_rule, asset: in_site,
sensor_reading: create(:sensor_reading, asset: in_site, organization: org))
    elsewhere = create(:asset, organization: org,
location: create(:location, organization: org, name: "Yard", location_type: "outdoor"))
    yard_alert = create(:iot_alert, iot_rule: create(:iot_rule, asset: elsewhere, organization: org), asset: elsewhere,
                                    sensor_reading: create(:sensor_reading, asset: elsewhere, organization: org))

    expect { described_class.perform_now(site_alert.id) }.to have_broadcasted_to("iot_alerts_org_#{org.id}_site_#{site.id}")
    expect { described_class.perform_now(yard_alert.id) }.to have_broadcasted_to("iot_alerts_org_#{org.id}_site_none")
    expect { described_class.perform_now(site_alert.id) }.to have_broadcasted_to("iot_alerts_org_#{org.id}")
  end

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
