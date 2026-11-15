require "rails_helper"

RSpec.describe IotAlertChannel, type: :channel do
  let(:org)   { create(:organization) }
  let(:other) { create(:organization) }
  let(:user)  { create(:user, organization: org) }

  it "streams the alerts of the person's own company" do
    stub_connection current_user: user

    subscribe

    expect(subscription).to be_confirmed
    expect(subscription).to have_stream_from("iot_alerts_org_#{org.id}")
  end

  it "does not stream another company's alerts, whatever the person asks for" do
    stub_connection current_user: user

    subscribe(organization_id: other.id, asset_id: 1)

    expect(subscription).to have_stream_from("iot_alerts_org_#{org.id}")
    expect(subscription).not_to have_stream_from("iot_alerts_org_#{other.id}")
  end

  describe "for a person who works at some sites only" do
    let(:north) { create(:location, organization: org, name: "North", location_type: "site") }
    let(:south) { create(:location, organization: org, name: "South", location_type: "site") }

    before do
      south
      org.update!(settings: org.settings.merge("sites_enabled" => true))
      SiteMembership.create!(user: user, site: north)
      stub_connection current_user: user
    end

    it "streams their site's alerts, and those of assets in no site, and not the company's, nor another site's" do
      subscribe

      expect(subscription).to have_stream_from("iot_alerts_org_#{org.id}_site_#{north.id}")
      expect(subscription).to have_stream_from("iot_alerts_org_#{org.id}_site_none")
      expect(subscription).not_to have_stream_from("iot_alerts_org_#{org.id}")
      expect(subscription).not_to have_stream_from("iot_alerts_org_#{org.id}_site_#{south.id}")
    end

    it "streams each site of a person at two" do
      SiteMembership.create!(user: user, site: south)

      subscribe

      expect(subscription).to have_stream_from("iot_alerts_org_#{org.id}_site_#{south.id}")
    end

    it "streams the whole company's alerts for an administrator, for someone at no site, and while sites are off" do
      stub_connection current_user: create(:user, :admin, organization: org)
      subscribe
      expect(subscription).to have_stream_from("iot_alerts_org_#{org.id}")

      stub_connection current_user: create(:user, organization: org)
      subscribe
      expect(subscription).to have_stream_from("iot_alerts_org_#{org.id}")

      org.update!(settings: org.settings.merge("sites_enabled" => false))
      stub_connection current_user: user
      subscribe
      expect(subscription).to have_stream_from("iot_alerts_org_#{org.id}")
    end
  end

  it "gives each company its own stream" do
    expect(described_class.stream_for_company(org.id)).not_to eq(described_class.stream_for_company(other.id))
  end

  it "stops streaming when the person leaves" do
    stub_connection current_user: user
    subscribe

    unsubscribe

    expect(subscription).not_to have_streams
  end
end
