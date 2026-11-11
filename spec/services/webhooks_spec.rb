require "rails_helper"

RSpec.describe Webhooks do
  include ActiveJob::TestHelper

  let(:org) { create(:organization) }
  let(:other_org) { create(:organization) }
  let(:tech) { create(:user, organization: org) }

  before { allow(Resolv).to receive(:getaddresses).and_return(["203.0.113.10"]) }

  def listen(events, organization: org, **attrs) = create(:webhook, organization: organization, events: events, **attrs)
  def deliveries = WebhookDelivery.order(:id)
  def payload(delivery) = delivery.payload

  describe "work orders" do
    it "tells a webhook about a new work order, with the same shape the API answers with" do
      hook = listen(%w[work_order.created])

      work_order = nil
      expect {
        work_order = create(:work_order, organization: org, title: "Leak", priority: "high")
      }.to have_enqueued_job(WebhookDeliveryJob)

      delivery = deliveries.last
      expect(delivery).to have_attributes(webhook_id: hook.id, event: "work_order.created", status: "pending", organization_id: org.id)
      expect(payload(delivery)).to include("event" => "work_order.created", "id" => delivery.event_id)
      expect(payload(delivery)["created_at"]).to be_present
      expect(payload(delivery).dig("data",
"work_order")).to include("id" => work_order.id, "title" => "Leak", "priority" => "high", "status" => "open")
      expect(payload(delivery).dig("data", "work_order")).to eq(JSON.parse(PublicApi::WorkOrderBlueprint.render_as_hash(work_order).to_json))
    end

    it "tells about each step of a work order's life, once, with the old and the new status" do # rubocop:disable RSpec/ExampleLength
      listen(Webhooks::EVENTS.keys.grep(/\Awork_order\./))
      work_order = create(:work_order, organization: org)
      deliveries.delete_all

      work_order.update!(assignee: tech)
      work_order.assign!
      work_order.start!
      work_order.hold!
      work_order.resume!
      work_order.need_parts!
      work_order.resume!
      work_order.completion_notes = "Done"
      work_order.complete!
      work_order.verified_by = create(:user, :manager, organization: org)
      work_order.verify!

      expect(deliveries.pluck(:event)).to eq(%w[work_order.assigned work_order.started work_order.on_hold work_order.started
                                                work_order.pending_parts work_order.started work_order.completed work_order.verified])
      completed = deliveries.find_by(event: "work_order.completed")
      expect(payload(completed)["changes"]).to eq("status" => %w[in_progress completed])
      expect(payload(completed).dig("data", "work_order", "completion_notes")).to eq("Done")
    end

    it "tells about a cancellation" do
      listen(%w[work_order.cancelled])
      work_order = create(:work_order, organization: org)

      work_order.update!(cancellation_reason: "Duplicate")
      work_order.cancel!

      expect(deliveries.pluck(:event)).to eq(%w[work_order.cancelled])
      expect(payload(deliveries.last).dig("data", "work_order", "cancellation_reason")).to eq("Duplicate")
    end

    it "does not tell about a change that is not a change of status (a new title)" do
      listen(Webhooks::EVENTS.keys)
      work_order = create(:work_order, organization: org)
      deliveries.delete_all

      work_order.update!(title: "Retitled")

      expect(deliveries).to be_empty
    end

    it "sends a webhook only the events it asked for, and only its own company's" do
      mine = listen(%w[work_order.created])
      listen(%w[work_order.completed])
      theirs = listen(%w[work_order.created], organization: other_org)

      create(:work_order, organization: org)

      expect(deliveries.pluck(:webhook_id)).to eq([mine.id])
      expect(WebhookDelivery.where(webhook_id: theirs.id)).to be_empty
    end

    it "does not send to a webhook that is switched off, or disabled for failing" do
      listen(%w[work_order.created], active: false)
      listen(%w[work_order.created], disabled_at: Time.current, disabled_reason: "failing")

      create(:work_order, organization: org)

      expect(deliveries).to be_empty
    end

    it "sends to several webhooks, one delivery for each, with the same event id" do
      listen(%w[work_order.created], name: "n8n")
      listen(%w[work_order.created], name: "Zapier")

      create(:work_order, organization: org)

      expect(deliveries.count).to eq(2)
      expect(deliveries.pluck(:event_id).uniq.size).to eq(1)
    end

    it "tells nobody about something that was rolled back" do
      listen(%w[work_order.created])

      expect do
        ActiveRecord::Base.transaction do
          create(:work_order, organization: org)
          raise ActiveRecord::Rollback
        end
      end.not_to have_enqueued_job(WebhookDeliveryJob) # a job queued before the commit could run for work that never happened

      expect(deliveries).to be_empty
    end

    it "never breaks the thing that happened when the webhook side fails" do
      listen(%w[work_order.created])
      allow(WebhookDelivery).to receive(:create!).and_raise(ActiveRecord::StatementInvalid, "boom")

      expect { create(:work_order, organization: org) }.not_to raise_error
      expect(WorkOrder.count).to eq(1)
    end
  end

  describe "assets" do
    it "tells about a new asset, and a change of status with the old and new" do
      listen(%w[asset.created asset.status_changed])

      asset = create(:asset, organization: org, status: "operational")
      asset.update!(name: "Renamed")
      asset.update!(status: "down")

      expect(deliveries.pluck(:event)).to eq(%w[asset.created asset.status_changed])
      expect(payload(deliveries.last)["changes"]).to eq("status" => %w[operational down])
      expect(payload(deliveries.last).dig("data", "asset", "status")).to eq("down")
    end
  end

  describe "sensor alerts and parts" do
    it "tells about a sensor alert" do
      listen(%w[iot_alert.created])
      asset = create(:asset, organization: org)
      alert = create(:iot_alert, asset: asset, iot_rule: create(:iot_rule, organization: org, asset: asset))

      expect(deliveries.pluck(:event)).to eq(%w[iot_alert.created])
      expect(payload(deliveries.last).dig("data", "iot_alert")).to include("id" => alert.id, "asset" => include("id" => asset.id))
      expect(payload(deliveries.last).dig("data", "iot_alert", "threshold")).to be_a(Float)
    end

    it "tells when a part falls to its reorder point, or runs out" do
      listen(%w[part.low_stock])
      part = create(:part, organization: org, quantity_on_hand: 1, reorder_point: 2)

      LowStockAlertJob.perform_now(part.id, "low")
      LowStockAlertJob.perform_now(part.id, "out")

      expect(deliveries.count).to eq(2)
      expect(payload(deliveries.first)["changes"]).to eq("stock" => "low")
      expect(payload(deliveries.last).dig("data", "part", "quantity_on_hand")).to eq(1.0)
    end
  end

  it "knows every event it can send, with words for them" do
    expect(Webhooks::EVENTS.keys).to include("work_order.completed", "asset.status_changed", "iot_alert.created", "part.low_stock")
    expect(Webhooks::EVENTS.values).to all(be_present)
    expect(WorkOrderWebhooks::STATUS_EVENTS.values - Webhooks::EVENTS.keys).to be_empty
  end
end
