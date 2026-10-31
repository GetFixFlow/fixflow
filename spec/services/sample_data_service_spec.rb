require "rails_helper"

RSpec.describe SampleDataService do
  include ActiveJob::TestHelper

  let(:org)   { create(:organization) }
  let(:admin) { create(:user, :admin, organization: org) }
  let!(:tech) { create(:user, organization: org) }

  def load_sample = described_class.load!(org, admin)

  describe ".load!" do
    it "fills the company with places, parts, assets, a schedule and work orders, all plainly marked as samples" do
      counts = load_sample

      expect(counts).to include("Location" => 3, "Part" => 4, "Asset" => 5, "PreventiveMaintenance" => 1)
      expect(counts["WorkOrder"]).to eq(9) # one from the schedule, three open or assigned, five finished
      names = org.locations.pluck(:name) + org.parts.pluck(:name) + org.assets.pluck(:name) + org.work_orders.pluck(:title) +
              org.preventive_maintenances.pluck(:name)
      expect(names).to all(start_with("Sample: "))
    end

    it "gives the work order made by the schedule a checklist, with the first step already ticked" do
      load_sample

      from_schedule = org.work_orders.find_by(title: "Sample: Monthly pump service")
      expect(from_schedule).to have_attributes(status: "in_progress", assignee: tech)
      expect(from_schedule.checklist.pluck("completed")).to eq([true, false, false, false])
      expect(from_schedule.incomplete_required_steps.size).to eq(2)
    end

    it "shows the work in every state, so lists, the dashboard and reports have something in them" do
      load_sample

      expect(org.work_orders.group(:status).count).to eq("open" => 2, "assigned" => 1, "in_progress" => 1, "completed" => 5)
      expect(org.assets.pluck(:status)).to contain_exactly("operational", "degraded", "operational", "operational", "down")
    end

    it "includes finished work with parts and hours, spread over the last weeks" do
      load_sample

      done = org.work_orders.where(status: "completed")
      expect(done.pluck(:completed_at).map { |t| t > 40.days.ago }).to all(be(true))
      expect(done.pluck(:parts_cost)).to all(satisfy(&:positive?))
      expect(done.pluck(:actual_hours)).to all(satisfy(&:positive?))
    end

    it "includes work finished this week, so the dashboard's counts are not all zero" do
      load_sample

      expect(org.work_orders.where(status: "completed").where(completed_at: 7.days.ago..).count).to eq(1)
    end

    it "includes a part that is at its reorder point, for the low-stock view" do
      load_sample

      expect(org.parts.low_stock.pluck(:name)).to eq(["Sample: V-belt"])
    end

    it "creates no accounts, and sends no email and no alerts" do
      admin # (made now, so that it is not counted as something the loading created)
      expect { load_sample }.not_to change(User, :count)
      expect(ActionMailer::Base.deliveries).to be_empty
      expect(enqueued_jobs).to be_empty
    end

    it "uses the person loading it when the company has no technician" do
      tech.destroy

      load_sample

      expect(org.work_orders.find_by(title: "Sample: Monthly pump service").assignee).to eq(admin)
    end

    it "refuses to load twice" do
      load_sample

      expect { load_sample }.to raise_error(described_class::AlreadyLoaded, /already loaded/)
      expect(org.assets.count).to eq(5)
    end

    it "is per company, and does not touch another" do
      other = create(:organization)
      create(:asset, organization: other, name: "Their pump")

      load_sample

      expect(other.assets.pluck(:name)).to eq(["Their pump"])
      expect(described_class.loaded?(other)).to be(false)
    end

    it "is all or nothing" do
      allow(PreventiveMaintenance).to receive(:create!).and_raise("boom") # after places, parts and assets were made

      expect { load_sample }.to raise_error("boom")

      expect(org.assets.count).to eq(0)
      expect(described_class.loaded?(org)).to be(false)
    end
  end

  describe ".remove!" do
    it "takes out everything that was loaded, and says how much" do
      load_sample

      report = described_class.remove!(org)

      expect(report[:removed]).to eq("WorkOrder" => 9, "PreventiveMaintenance" => 1, "Asset" => 5, "Part" => 4, "Location" => 3)
      expect(report[:kept]).to be_empty
      expect([org.assets, org.parts, org.locations, org.work_orders,
              org.preventive_maintenances].map(&:count)).to eq([0, 0, 0, 0, 0])
      expect(described_class.loaded?(org)).to be(false)
    end

    it "leaves everything real exactly as it was" do
      real_asset = create(:asset, organization: org, name: "Real pump")
      real_part  = create(:part, organization: org, name: "Real filter")
      real_wo    = create(:work_order, organization: org, asset: real_asset, title: "Real job", work_order_number: "REAL-0")
      load_sample

      described_class.remove!(org)

      expect([real_asset, real_part, real_wo].map { |r| r.class.exists?(r.id) }).to all(be(true))
      expect(real_wo.reload.asset).to eq(real_asset)
    end

    it "can load again afterwards" do
      load_sample
      described_class.remove!(org)

      expect { load_sample }.not_to raise_error
      expect(org.assets.count).to eq(5)
    end

    it "does nothing when nothing was loaded" do
      expect(described_class.remove!(org)).to eq(removed: {}, kept: [])
    end

    it "keeps a sample asset that a real work order now uses, and says why" do
      load_sample
      sample_asset = org.assets.find_by(name: "Sample: Pump 01")
      create(:work_order, organization: org, asset: sample_asset, title: "Real job on the sample pump", work_order_number: "REAL-1")

      report = described_class.remove!(org)

      expect(org.assets.pluck(:name)).to eq(["Sample: Pump 01"])
      expect(report[:kept]).to include(a_hash_including(type: "Asset", name: "Sample: Pump 01",
reason: /work orders or schedules you created/))
      expect(org.work_orders.pluck(:title)).to eq(["Real job on the sample pump"])
    end

    it "keeps a sample asset that has a manual added to it, and the manual" do
      load_sample
      sample_asset = org.assets.find_by(name: "Sample: Pump 01")
      create(:asset_document, asset: sample_asset)

      report = described_class.remove!(org)

      expect(org.assets.pluck(:name)).to eq(["Sample: Pump 01"])
      expect(report[:kept]).to include(a_hash_including(type: "Asset", name: "Sample: Pump 01", reason: /you added documents/))
      expect(sample_asset.documents.count).to eq(1)
    end

    it "keeps a sample part used on a real work order" do
      load_sample
      part = org.parts.find_by(name: "Sample: Oil filter")
      real = create(:work_order, organization: org, title: "Real job", work_order_number: "REAL-2")
      create(:work_order_part, work_order: real, part: part)

      report = described_class.remove!(org)

      expect(org.parts.pluck(:name)).to eq(["Sample: Oil filter"])
      expect(report[:kept]).to include(a_hash_including(type: "Part", reason: /used on work orders you created/))
      expect(real.work_order_parts.count).to eq(1)
    end

    it "keeps a sample part that is on a purchase request" do
      load_sample
      part = org.parts.find_by(name: "Sample: Oil filter")
      request = org.purchase_orders.new(reason: "Running low")
      request.lines.build(part: part, quantity: 4)
      request.save!

      report = described_class.remove!(org)

      expect(org.parts.pluck(:name)).to eq(["Sample: Oil filter"])
      expect(report[:kept]).to include(a_hash_including(type: "Part", reason: /purchase request or order/))
    end

    it "keeps a sample place that has real things in it, together with the places above it" do
      load_sample
      floor = org.locations.find_by(name: "Sample: Floor 1")
      real = create(:asset, organization: org, name: "Real compressor", location: floor)

      report = described_class.remove!(org)

      expect(org.locations.pluck(:name)).to contain_exactly("Sample: Plant", "Sample: Floor 1")
      expect(report[:kept].pluck(:type)).to eq(%w[Location Location])
      expect(real.reload.location).to eq(floor)
    end

    it "keeps a sample schedule whose real work orders still exist" do
      load_sample
      schedule = org.preventive_maintenances.first
      create(:work_order, organization: org, preventive_maintenance: schedule, title: "Made from the schedule later",
work_order_number: "REAL-3")

      report = described_class.remove!(org)

      expect(org.preventive_maintenances.count).to eq(1)
      expect(report[:kept]).to include(a_hash_including(type: "PreventiveMaintenance"))
      # ...and so does the asset it is for, as deleting an asset deletes its schedules
      expect(org.assets.where("name LIKE ?", "Sample:%").pluck(:name)).to eq(["Sample: Pump 01"])
    end

    it "treats what was kept as the company's own from then on" do
      load_sample
      create(:work_order, organization: org, asset: org.assets.find_by(name: "Sample: Pump 01"), title: "Real",
work_order_number: "REAL-4")
      described_class.remove!(org)

      expect(described_class.loaded?(org)).to be(false)
      expect(described_class.remove!(org)).to eq(removed: {}, kept: [])
    end
  end
end
