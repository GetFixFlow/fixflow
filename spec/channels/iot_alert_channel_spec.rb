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
