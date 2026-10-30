require "rails_helper"

# The five events that are also emailed or pushed are posted to the company's chat from the places that send those.
RSpec.describe "Posting to the company's chat" do
  include ActiveJob::TestHelper

  let(:org)      { create(:organization) }
  let(:assignee) { create(:user, organization: org, first_name: "Ana", last_name: "Perera") }
  let(:work_order) do
    ActsAsTenant.with_tenant(org) do
      create(:work_order, organization: org, requester: create(:user, organization: org), assignee: assignee,
title: "Pump 3 is leaking")
    end
  end

  def chat_on(*events)
    allow(Resolv).to receive(:getaddresses).and_return(["203.0.113.10"])
    org.chat_config.assign(kind: "slack", enabled: true, url: "https://hooks.slack.com/services/T0/B0/X", events: events).save_to(org)
  end

  def posts
    enqueued_jobs.select { |job| job["job_class"] == "ChatMessageJob" }.map { |job| job["arguments"] }
                 .map { |_org, event, title, body, link| { event: event, title: title, body: body, link: link } }
  end

  it "posts an assignment, with the number, who it went to, the title and a link" do
    chat_on("wo_assigned")

    NotifyAssigneeJob.perform_now(work_order.id)

    expect(posts).to eq([{ event: "wo_assigned", title: "#{work_order.work_order_number} assigned to Ana Perera",
                           body: "Pump 3 is leaking", link: "#{EmailSetup.base_url}/work-orders/#{work_order.id}" }])
  end

  it "posts work that needs verifying" do
    chat_on("wo_needs_verification")

    NotifyManagerJob.perform_now(work_order.id)

    expect(posts.pluck(:event,
:title)).to eq([["wo_needs_verification", "#{work_order.work_order_number} is finished and needs verifying"]])
  end

  it "posts a problem reported from a QR label" do
    chat_on("wo_new_request")

    NotifyNewRequestJob.perform_now(work_order.id)

    expect(posts.pluck(:event, :title)).to eq([["wo_new_request", "New problem reported: #{work_order.work_order_number}"]])
  end

  it "posts a part running low, or out" do
    chat_on("part_low_stock")
    part = ActsAsTenant.with_tenant(org) { create(:part, organization: org, name: "Belt", quantity_on_hand: 2, reorder_point: 5) }

    LowStockAlertJob.perform_now(part.id, "low")
    LowStockAlertJob.perform_now(part.id, "out")

    expect(posts.pluck(:title,
:body)).to eq([["Running low: Belt", "2.0 left (reorder at 5.0)"], ["Out of stock: Belt", "2.0 left (reorder at 5.0)"]])
  end

  context "with a sensor alert" do
    let(:asset)   { create(:asset, organization: org, name: "Pump 3") }
    let(:reading) { create(:sensor_reading, asset: asset, organization: org) }

    def alert(priority)
      rule = create(:iot_rule, asset: asset, organization: org, wo_priority: priority, unit: "°C")
      create(:iot_alert, iot_rule: rule, asset: asset, sensor_reading: reading)
    end

    it "posts a critical or a high alert, with what the alert says" do
      chat_on("iot_alert")

      Iot::AlertNotificationJob.perform_now(alert(:critical).id)
      Iot::AlertNotificationJob.perform_now(alert(:high).id)

      expect(posts.pluck(:title)).to eq(["Critical sensor alert: Pump 3", "High sensor alert: Pump 3"])
      expect(posts.first[:body]).to include("temperature above")
    end

    it "does not post a medium or low alert, which would only bury the serious ones" do
      chat_on("iot_alert")

      Iot::AlertNotificationJob.perform_now(alert(:medium).id)
      Iot::AlertNotificationJob.perform_now(alert(:low).id)

      expect(posts).to be_empty
    end
  end

  it "posts only the events that are ticked" do
    chat_on("iot_alert")

    NotifyAssigneeJob.perform_now(work_order.id)

    expect(posts).to be_empty
  end

  it "posts nothing for a company that has not set chat up" do
    NotifyAssigneeJob.perform_now(work_order.id)
    NotifyManagerJob.perform_now(work_order.id)

    expect(posts).to be_empty
  end

  it "does not break the thing that caused it when the queue is down" do
    chat_on("wo_assigned")
    allow(ChatMessageJob).to receive(:perform_later).and_raise(Redis::CannotConnectError)

    expect { NotifyAssigneeJob.perform_now(work_order.id) }.not_to raise_error
  end

  it "still sends the email and the push beside the chat message" do
    chat_on("wo_assigned")

    expect { NotifyAssigneeJob.perform_now(work_order.id) }.to have_enqueued_mail(WorkOrderMailer, :assigned)
  end
end
