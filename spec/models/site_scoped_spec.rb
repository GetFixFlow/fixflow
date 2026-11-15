require "rails_helper"

# rubocop:disable RSpec/MultipleMemoizedHelpers, RSpec/LetSetup -- a company with two sites, their places and assets

# What is in another site is hidden from a person who works at some sites only (see SiteAccess), for every way of reaching it.
RSpec.describe SiteScoped do
  let(:org) { create(:organization) }
  let(:north) { create(:location, organization: org, name: "North", location_type: "site") }
  let(:north_hall) { create(:location, organization: org, name: "North hall", location_type: "building", parent: north) }
  let(:south) { create(:location, organization: org, name: "South", location_type: "site") }
  let(:south_hall) { create(:location, organization: org, name: "South hall", location_type: "building", parent: south) }
  let(:yard) { create(:location, organization: org, name: "Yard", location_type: "outdoor") }

  let!(:mine) { create(:asset, organization: org, name: "Pump north", location: north_hall) }
  let!(:theirs) { create(:asset, organization: org, name: "Pump south", location: south_hall) }
  let!(:shared) { create(:asset, organization: org, name: "Pump in the yard", location: yard) }
  let!(:placeless) { create(:asset, organization: org, name: "Pump nowhere") }

  def hiding(*places) = Current.hidden_location_ids = places.map(&:id)

  after { Current.reset }

  it "hides nothing when nothing is hidden: a request, job or console that has not set it" do
    expect(Asset.pluck(:name)).to contain_exactly("Pump north", "Pump south", "Pump in the yard", "Pump nowhere")
    Current.hidden_location_ids = []
    expect(Asset.count).to eq(4)
  end

  describe "assets and places" do
    before { hiding(south, south_hall) }

    it "hides the other site's assets, and keeps mine, the shared ones, and those with no place" do
      expect(Asset.pluck(:name)).to contain_exactly("Pump north", "Pump in the yard", "Pump nowhere")
    end

    it "makes a hidden asset unfindable by its id, not just left out of lists" do
      expect { Asset.find(theirs.id) }.to raise_error(ActiveRecord::RecordNotFound)
      expect(org.assets.find_by(id: theirs.id)).to be_nil
      expect(Asset.unscoped.find(theirs.id)).to eq(theirs)
    end

    it "hides the other site's places" do
      expect(Location.pluck(:name)).to contain_exactly("North", "North hall", "Yard")
      expect { Location.find(south_hall.id) }.to raise_error(ActiveRecord::RecordNotFound)
    end

    it "still shows the places above an asset I can see" do
      expect(Asset.find(mine.id).location.full_path).to eq("North > North hall")
    end
  end

  describe "what hangs off an asset" do
    let!(:my_order) { create(:work_order, organization: org, asset: mine, title: "Mine") }
    let!(:their_order) { create(:work_order, organization: org, asset: theirs, title: "Theirs") }
    let!(:general_order) { create(:work_order, organization: org, asset: nil, title: "About nothing in particular") }

    before { hiding(south, south_hall) }

    it "hides the other site's work orders, and keeps those with no asset (shared)" do
      expect(WorkOrder.pluck(:title)).to contain_exactly("Mine", "About nothing in particular")
      expect { WorkOrder.find(their_order.id) }.to raise_error(ActiveRecord::RecordNotFound)
    end

    it "hides the work orders of a hidden asset through the asset too" do
      expect(theirs.work_orders.count).to eq(0)
      expect(mine.work_orders.count).to eq(1)
    end

    it "hides preventive maintenance, meters, sensors, alerts, flags, documents and downtime of another site's assets" do
      Current.hidden_location_ids = nil # made before anything is hidden, as it would have been
      rule = ->(asset) { create(:iot_rule, asset: asset, organization: org) }
      kept = [create(:preventive_maintenance, asset: mine, organization: org), create(:meter, asset: mine, organization: org),
              rule.call(mine),
              create(:sensor_reading, asset: mine, organization: org), create(:sensor_anomaly, asset: mine, organization: org)]
      gone = [create(:preventive_maintenance, asset: theirs, organization: org), create(:meter, asset: theirs, organization: org),
              rule.call(theirs),
              create(:sensor_reading, asset: theirs, organization: org), create(:sensor_anomaly, asset: theirs, organization: org)]
      hiding(south, south_hall)

      kept.each { |record| expect(record.class.exists?(record.id)).to be(true), "#{record.class} of my asset should show" }
      gone.each { |record| expect(record.class.exists?(record.id)).to be(false), "#{record.class} of their asset should be hidden" }
    end

    it "hides the alerts, documents, downtime and summaries of another site's assets" do
      alert = lambda { |asset|
        create(:iot_alert, iot_rule: create(:iot_rule, asset: asset, organization: org), asset: asset,
      sensor_reading: create(:sensor_reading, asset: asset, organization: org))
      }
      Current.hidden_location_ids = nil
      mine_alert = alert.call(mine)
      their_alert = alert.call(theirs)
      hiding(south, south_hall)

      expect(IotAlert.pluck(:id)).to eq([mine_alert.id])
      expect(IotAlert.unscoped.pluck(:id)).to include(their_alert.id)
      expect(SensorAggregate.count).to eq(0)
      expect(AssetDocument.count).to eq(0)
      expect(AssetDowntime.count).to eq(0)
    end

    it "is applied to what a join or an association reaches too" do
      expect(org.work_orders.joins(:asset).pluck(:title)).to eq(["Mine"])
      expect(WorkOrder.where(asset_id: [mine.id, theirs.id]).pluck(:title)).to eq(["Mine"])
    end
  end

  describe "pointing something at what is hidden" do
    before { hiding(south, south_hall) }

    it "refuses a work order for another site's asset, by its number, but not for mine or for none" do
      expect(build(:work_order, organization: org, asset: theirs)).not_to be_valid
      expect(build(:work_order, organization: org, asset: theirs).tap(&:valid?).errors[:asset]).to eq(["is not at one of your sites"])
      expect(build(:work_order, organization: org, asset: mine)).to be_valid
      expect(build(:work_order, organization: org, asset: nil)).to be_valid
    end

    it "refuses preventive maintenance and a meter for another site's asset" do
      expect(build(:preventive_maintenance, organization: org, asset: theirs)).not_to be_valid
      expect(build(:meter, organization: org, asset: theirs)).not_to be_valid
    end

    it "refuses to move an asset into another site, or to put a new one there" do
      expect(build(:asset, organization: org, location: south_hall)).not_to be_valid
      expect(mine.tap { |asset| asset.location = south_hall }).not_to be_valid
      expect(build(:asset, organization: org, location: north_hall)).to be_valid
      expect(build(:asset, organization: org, location: yard)).to be_valid
    end

    it "does not hold up a change to a record that is already there and left alone" do
      Current.hidden_location_ids = nil
      theirs_order = create(:work_order, organization: org, asset: theirs)
      hiding(south, south_hall)

      expect(WorkOrder.unscoped.find(theirs_order.id).tap { |order| order.title = "Edited" }).to be_valid
    end

    it "applies to nobody when nothing is hidden" do
      Current.hidden_location_ids = nil

      expect(build(:work_order, organization: org, asset: theirs)).to be_valid
    end
  end

  describe "a person at both sites" do
    it "sees both when nothing of theirs is hidden" do
      hiding

      expect(Asset.count).to eq(4)
    end
  end
end
# rubocop:enable RSpec/MultipleMemoizedHelpers, RSpec/LetSetup
