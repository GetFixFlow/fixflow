require "rails_helper"

RSpec.describe Asset, "#public_code" do
  let(:organization) { create(:organization) }

  it "is a random code of at least 24 characters, made when the asset is created" do
    asset = ActsAsTenant.with_tenant(organization) { create(:asset, organization: organization) }

    expect(asset.public_code).to match(/\A[A-Za-z0-9]{24}\z/)
  end

  it "is different for every asset and cannot be worked out from the id or the tag" do
    first, second = ActsAsTenant.with_tenant(organization) { create_list(:asset, 2, organization: organization) }

    expect(first.public_code).not_to eq(second.public_code)
    expect(first.public_code).not_to include(first.asset_tag)
    expect(first.public_code).not_to include(first.id.to_s.rjust(6, "0"))
  end

  it "stays the same when the asset is changed (a printed label keeps working)" do
    asset = ActsAsTenant.with_tenant(organization) { create(:asset, organization: organization) }

    expect { asset.update!(name: "Renamed", status: "down") }.not_to(change { asset.reload.public_code })
  end

  it "is shown to the team, so the label can be printed" do
    asset = ActsAsTenant.with_tenant(organization) { create(:asset, organization: organization) }

    expect(AssetBlueprint.render_as_hash(asset)[:public_code]).to eq(asset.public_code)
    expect(AssetBlueprint.render_as_hash(asset, view: :extended)[:public_code]).to eq(asset.public_code)
  end

  describe ".search_by_name_or_tag" do
    it "finds the asset whose label was scanned, by the whole code only" do
      asset, other = ActsAsTenant.with_tenant(organization) { create_list(:asset, 2, organization: organization) }

      expect(described_class.search_by_name_or_tag(asset.public_code)).to contain_exactly(asset)
      expect(described_class.search_by_name_or_tag(asset.public_code.first(8))).to be_empty
      expect(described_class.search_by_name_or_tag(other.asset_tag)).to contain_exactly(other)
    end
  end
end
