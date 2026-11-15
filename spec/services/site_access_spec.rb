require "rails_helper"

RSpec.describe SiteAccess do
  let(:org) { create(:organization) }
  let(:north) { create(:location, organization: org, name: "North", location_type: "site") }
  let(:south) { create(:location, organization: org, name: "South", location_type: "site") }
  let(:north_hall) { create(:location, organization: org, name: "North hall", location_type: "building", parent: north) }
  let(:north_bay) { create(:location, organization: org, name: "North bay", location_type: "room", parent: north_hall) }
  let(:south_hall) { create(:location, organization: org, name: "South hall", location_type: "building", parent: south) }
  let(:yard) { create(:location, organization: org, name: "Yard", location_type: "outdoor") }
  let(:tech) { create(:user, organization: org) }

  def switch_on = org.update!(settings: org.settings.merge("sites_enabled" => true))

  def assign(user, *sites) = sites.each { |site| SiteMembership.create!(user: user, site: site) }

  describe ".hidden_location_ids" do
    before { [north, north_hall, north_bay, south, south_hall, yard] }

    it "is nothing (everything is seen) until sites are switched on, even for someone assigned to a site" do
      assign(tech, north)

      expect(described_class.hidden_location_ids(tech)).to be_nil
    end

    it "is the other sites' places, every level of them, for someone assigned to one site" do
      switch_on
      assign(tech, north)

      expect(described_class.hidden_location_ids(tech)).to contain_exactly(south.id, south_hall.id)
    end

    it "hides nothing of a place that is in no site (shared), nor of the sites the person is assigned to" do
      switch_on
      assign(tech, north, south)

      expect(described_class.hidden_location_ids(tech)).to eq([])
      expect(described_class.hidden_location_ids(tech)).not_to include(yard.id)
    end

    it "sees everything for an administrator, and for someone assigned to no site" do
      switch_on
      assign(tech, north)

      expect(described_class.hidden_location_ids(create(:user, :admin, organization: org))).to be_nil
      expect(described_class.hidden_location_ids(create(:user, organization: org))).to be_nil
      expect(described_class.hidden_location_ids(nil)).to be_nil
    end

    it "sees everything for an administrator even when they are listed at a site (a person made an administrator later)" do
      switch_on
      lead = create(:user, :admin, organization: org)
      assign(lead, north)

      expect(described_class.hidden_location_ids(lead)).to be_nil
    end

    it "does not count a top-level place that is not of type site as a site" do
      switch_on
      assign(tech, north)

      expect(described_class.hidden_location_ids(tech)).not_to include(yard.id)
    end

    it "is about the person's own company only" do
      switch_on
      assign(tech, north)
      create(:location, location_type: "site", name: "Another company's site")

      expect(described_class.hidden_location_ids(tech)).to contain_exactly(south.id, south_hall.id)
    end
  end

  describe ".site_id_for" do
    it "is the top-level site a place is in, at any depth, and nil for a place in no site" do
      expect(described_class.site_id_for(north)).to eq(north.id)
      expect(described_class.site_id_for(north_hall)).to eq(north.id)
      expect(described_class.site_id_for(north_bay)).to eq(north.id)
      expect(described_class.site_id_for(yard)).to be_nil
      expect(described_class.site_id_for(nil)).to be_nil
    end
  end

  describe ".time_zone" do
    before { org.update!(settings: org.settings.merge("timezone" => "America/New_York", "sites_enabled" => true)) }

    it "is the company's with no sites in play, and for an administrator" do
      north.update!(settings: { "timezone" => "Asia/Colombo" })
      assign(tech, north)

      expect(described_class.time_zone(create(:user, :admin, organization: org))).to eq("America/New_York")
      expect(described_class.time_zone(create(:user, organization: org))).to eq("America/New_York")
      expect(described_class.time_zone(nil)).to eq("UTC")
    end

    it "is the person's first site's own, when it has one, else the company's" do
      north.update!(settings: { "timezone" => "Asia/Colombo" })
      assign(tech, north, south)

      expect(described_class.time_zone(tech)).to eq("Asia/Colombo")
      other = create(:user, organization: org)
      assign(other, south)
      expect(described_class.time_zone(other)).to eq("America/New_York")
    end

    it "is the company's for an administrator who is also listed at a site" do
      north.update!(settings: { "timezone" => "Asia/Colombo" })
      lead = create(:user, :admin, organization: org)
      assign(lead, north)

      expect(described_class.time_zone(lead)).to eq("America/New_York")
    end

    it "is the company's when sites are off" do
      org.update!(settings: org.settings.merge("sites_enabled" => false))
      north.update!(settings: { "timezone" => "Asia/Colombo" })
      assign(tech, north)

      expect(described_class.time_zone(tech)).to eq("America/New_York")
    end
  end
end
