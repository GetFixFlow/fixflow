require "rails_helper"

RSpec.describe IotChannel, type: :channel do
  let(:org)        { create(:organization) }
  let(:technician) { create(:user, organization: org) }
  let(:requester)  { create(:user, :requester, organization: org) }
  let(:asset)      { create(:asset, organization: org) }

  it "streams an asset's readings to the people who look after the equipment" do
    stub_connection current_user: technician

    subscribe(asset_id: asset.id)

    expect(subscription).to be_confirmed
    expect(subscription).to have_stream_from("iot_channel_asset_#{asset.id}")
  end

  it "refuses a requester, who has no sensor screens" do
    stub_connection current_user: requester

    subscribe(asset_id: asset.id)

    expect(subscription).to be_rejected
    expect(subscription.streams).to be_empty
  end

  it "refuses an asset of another company" do
    stub_connection current_user: technician

    subscribe(asset_id: create(:asset, organization: create(:organization)).id)

    expect(subscription).to be_rejected
  end
end
