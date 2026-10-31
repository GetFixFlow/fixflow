require "rails_helper"

RSpec.describe AssetDowntime do
  let(:org)   { create(:organization) }
  let(:asset) { create(:asset, organization: org) }
  let(:now)   { Time.utc(2026, 10, 16, 12, 0) }

  around { |example| travel_to(now) { example.run } }

  def stop(**attrs) = build(:asset_downtime, organization: org, asset: asset, **attrs)

  describe "validations" do
    it "accepts a stop that is over" do
      expect(stop(started_at: now - 5.hours, ended_at: now - 1.hour)).to be_valid
    end

    it "does not end before it starts" do
      downtime = stop(started_at: now - 1.hour, ended_at: now - 2.hours)

      expect(downtime).not_to be_valid
      expect(downtime.errors[:ended_at]).to include("must not be before it started")
    end

    it "cannot be in the future, within a few minutes of clock difference" do
      expect(stop(started_at: now + 1.hour, ended_at: nil)).not_to be_valid
      expect(stop(started_at: now - 1.hour, ended_at: now + 1.hour)).not_to be_valid
      expect(stop(started_at: now + 2.minutes, ended_at: nil)).to be_valid
    end

    it "does not overlap another time the asset was down" do
      create(:asset_downtime, organization: org, asset: asset, started_at: now - 10.hours, ended_at: now - 6.hours)

      expect(stop(started_at: now - 7.hours, ended_at: now - 5.hours)).not_to be_valid
      expect(stop(started_at: now - 11.hours, ended_at: now - 9.hours)).not_to be_valid
      expect(stop(started_at: now - 9.hours, ended_at: now - 7.hours)).not_to be_valid
      expect(stop(started_at: now - 8.hours, ended_at: nil)).not_to be_valid
      expect(stop(started_at: now - 6.hours, ended_at: now - 5.hours)).to be_valid # one ends as the next begins
      expect(stop(started_at: now - 12.hours, ended_at: now - 10.hours)).to be_valid
    end

    it "does not overlap one that is still going on" do
      create(:asset_downtime, organization: org, asset: asset, started_at: now - 3.hours, ended_at: nil)

      expect(stop(started_at: now - 2.hours, ended_at: now - 1.hour)).not_to be_valid
      expect(stop(started_at: now - 5.hours, ended_at: now - 4.hours)).to be_valid
    end

    it "does not count itself as overlapping when it is changed" do
      downtime = create(:asset_downtime, organization: org, asset: asset, started_at: now - 5.hours, ended_at: now - 2.hours)

      expect(downtime.update(ended_at: now - 1.hour)).to be(true)
    end

    it "allows another asset to be down at the same time" do
      create(:asset_downtime, organization: org, asset: asset, started_at: now - 5.hours, ended_at: now - 2.hours)

      expect(build(:asset_downtime, organization: org, started_at: now - 5.hours, ended_at: now - 2.hours)).to be_valid
    end

    it "must be for an asset of the same company" do
      other = create(:asset)

      expect(build(:asset_downtime, organization: org, asset: other)).not_to be_valid
    end

    it "keeps a note short" do
      expect(stop(reason: "x" * 201)).not_to be_valid
    end
  end

  describe "#hours_within" do
    let(:downtime) { stop(started_at: now - 10.hours, ended_at: now - 4.hours) }

    it "counts the part inside the period" do
      expect(downtime.hours_within(now - 8.hours, now)).to eq(4.0)
      expect(downtime.hours_within(now - 20.hours, now)).to eq(6.0)
      expect(downtime.hours_within(now - 20.hours, now - 8.hours)).to eq(2.0)
    end

    it "is nothing outside the period" do
      expect(downtime.hours_within(now - 3.hours, now)).to eq(0.0)
    end

    it "counts to now while it is still going on" do
      expect(stop(started_at: now - 3.hours, ended_at: nil).hours_within(now - 10.hours, now)).to eq(3.0)
    end
  end

  describe "the asset's status keeps it" do
    it "opens one when the asset goes down, and closes it when it runs again" do
      asset.update!(status: "down")
      expect(asset.downtimes.open.count).to eq(1)
      expect(asset.downtimes.first).to have_attributes(started_at: now, ended_at: nil)

      travel 3.hours
      asset.update!(status: "operational")

      expect(asset.downtimes.open).to be_empty
      expect(asset.downtimes.first).to have_attributes(started_at: now, ended_at: now + 3.hours)
    end

    it "opens one for an asset that is created down" do
      created = create(:asset, organization: org, status: "down")

      expect(created.downtimes.open.count).to eq(1)
    end

    it "ends it when the asset is degraded or decommissioned instead" do
      asset.update!(status: "down")
      asset.update!(status: "degraded")
      expect(asset.downtimes.open).to be_empty

      asset.update!(status: "down")
      asset.update!(status: "decommissioned")
      expect(asset.downtimes.open).to be_empty
      expect(asset.downtimes.count).to eq(2)
    end

    it "does not open a second when it is saved down again, or when it was already open by hand" do
      asset.update!(status: "down")
      asset.update!(name: "Boiler", status: "down")
      expect(asset.downtimes.count).to eq(1)

      other = create(:asset, organization: org)
      create(:asset_downtime, organization: org, asset: other, started_at: now - 2.hours, ended_at: nil)
      other.update!(status: "down")
      expect(other.downtimes.count).to eq(1)
      expect(other.downtimes.first.started_at).to eq(now - 2.hours)
    end

    it "does nothing for the other changes of status" do
      asset.update!(status: "degraded")
      asset.update!(status: "operational")

      expect(asset.downtimes).to be_empty
    end

    it "says who stopped it and who started it again" do
      stopper = create(:user, organization: org)
      starter = create(:user, :manager, organization: org)
      Current.set(user: stopper) { asset.update!(status: "down") }
      Current.set(user: starter) { asset.update!(status: "operational") }

      expect(asset.downtimes.first).to have_attributes(started_by: stopper, ended_by: starter)
    end

    it "goes with the asset" do
      asset.update!(status: "down")

      expect { asset.destroy! }.to change(described_class, :count).by(-1)
    end

    it "adds no line of its own to the audit log (the asset's says its status changed), and the line it does write names the asset" do
      asset.update!(status: "down")
      asset.update!(status: "operational")

      expect(ActivityLog.where(resource_type: "AssetDowntime")).to be_empty
      expect(ActivityLog.where(resource_type: "Asset", resource_id: asset.id).pluck(:action)).to include("asset.updated")
    end

    it "is written to the audit log when a time or the note is corrected, naming the field and the asset" do
      downtime = create(:asset_downtime, organization: org, asset: asset, started_at: now - 5.hours, ended_at: now - 2.hours)
      downtime.update!(reason: "Bearing failed")

      log = ActivityLog.where(resource_type: "AssetDowntime", resource_id: downtime.id, action: "asset_downtime.updated").last
      expect(log.metadata["changed"]).to eq(["reason"])
      expect(log.resource_name).to eq(asset.name)
    end
  end
end
