require "rails_helper"

RSpec.describe SiteMembership do
  let(:org) { create(:organization) }
  let(:site) { create(:location, organization: org, location_type: "site") }
  let(:person) { create(:user, organization: org) }

  it "is a person at a top-level place of type site of their own company" do
    expect(described_class.new(user: person, site: site)).to be_valid
  end

  it "is not a person at a place that is not a site: a building, a yard, or a place of that type inside a site" do
    building = create(:location, organization: org, location_type: "building", parent: site)
    yard = create(:location, organization: org, location_type: "outdoor")
    inner = create(:location, organization: org, location_type: "site", parent: site)

    [building, yard, inner].each do |place|
      membership = described_class.new(user: person, site: place)
      expect(membership).not_to be_valid
      expect(membership.errors[:site]).to include("must be a site of the same company")
    end
  end

  it "is not a person at another company's site" do
    expect(described_class.new(user: person, site: create(:location, location_type: "site"))).not_to be_valid
  end

  it "is once for a person at a site" do
    described_class.create!(user: person, site: site)

    expect(described_class.new(user: person, site: site)).not_to be_valid
  end

  it "goes when the site is removed" do
    described_class.create!(user: person, site: site)

    expect { site.destroy! }.to change(described_class, :count).by(-1)
  end
end
