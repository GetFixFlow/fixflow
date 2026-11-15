require "rails_helper"

RSpec.describe Location do
  let(:org) { create(:organization) }
  let(:site) { create(:location, organization: org, location_type: "site") }

  describe "#site? and .sites" do
    it "are only the top-level places of type site" do
      inner = create(:location, organization: org, location_type: "site", parent: site)
      yard = create(:location, organization: org, location_type: "outdoor")

      expect(site.site?).to be(true)
      expect(inner.site?).to be(false)
      expect(yard.site?).to be(false)
      expect(described_class.sites).to contain_exactly(site)
    end
  end
end
