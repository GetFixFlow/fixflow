require "rails_helper"

RSpec.describe Part do
  include ActiveJob::TestHelper

  describe "low-stock alerts" do
    let(:org)  { create(:organization) }
    let(:part) { create(:part, organization: org, quantity_on_hand: 10, reorder_point: 3) }

    def alerts = enqueued_jobs.select { |j| j["job_class"] == "LowStockAlertJob" }

    before { part } # created before the example's changes, so creating it is not what is measured

    it "alerts once when stock falls to the reorder point" do
      expect { part.adjust_stock(7, direction: :remove) }.to have_enqueued_job(LowStockAlertJob).with(part.id, "low")
    end

    it "alerts when stock falls below the reorder point from above it" do
      expect { part.adjust_stock(9, direction: :remove) }.to have_enqueued_job(LowStockAlertJob).with(part.id, "low")
    end

    it "does not alert while stock is still comfortably above the reorder point" do
      expect { part.adjust_stock(6, direction: :remove) }.not_to have_enqueued_job(LowStockAlertJob)
    end

    it "does not repeat the alert while the part stays low" do
      part.adjust_stock(8, direction: :remove)
      expect { part.adjust_stock(1, direction: :remove) }.not_to have_enqueued_job(LowStockAlertJob)
    end

    it "alerts again that it ran out, as that is worse than low" do
      part.adjust_stock(8, direction: :remove)
      expect { part.adjust_stock(2, direction: :remove) }.to have_enqueued_job(LowStockAlertJob).with(part.id, "out")
    end

    it "says out, not low, when a part goes straight from plenty to none" do
      expect { part.adjust_stock(10, direction: :remove) }.to have_enqueued_job(LowStockAlertJob).with(part.id, "out")
    end

    it "alerts again after it has been restocked and falls low again" do
      part.adjust_stock(8, direction: :remove)
      part.adjust_stock(20, direction: :add)
      expect { part.adjust_stock(20, direction: :remove) }.to have_enqueued_job(LowStockAlertJob).with(part.id, "low")
    end

    it "does not alert when stock goes up" do
      part.adjust_stock(8, direction: :remove)
      expect { part.adjust_stock(5, direction: :add) }.not_to have_enqueued_job(LowStockAlertJob)
    end

    it "alerts when raising the reorder point puts a part into low stock" do
      expect { part.update!(reorder_point: 12) }.to have_enqueued_job(LowStockAlertJob).with(part.id, "low")
    end

    it "does not alert for a new part that is added already low, or for edits to its name" do
      expect { create(:part, organization: org, quantity_on_hand: 1, reorder_point: 5) }.not_to have_enqueued_job(LowStockAlertJob)
      expect { part.update!(name: "Renamed") }.not_to have_enqueued_job(LowStockAlertJob)
    end

    it "does not alert when a work order's change is rolled back" do
      expect do
        ActiveRecord::Base.transaction do
          part.adjust_stock(9, direction: :remove)
          raise ActiveRecord::Rollback
        end
      end.not_to have_enqueued_job(LowStockAlertJob)
    end
  end
end
