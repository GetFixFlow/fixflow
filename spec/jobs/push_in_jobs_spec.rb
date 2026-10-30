require "rails_helper"

# The six events that are also emails are pushed from the places that send the emails.
RSpec.describe "Pushing what is also emailed" do
  include ActiveJob::TestHelper

  let(:org)      { create(:organization) }
  let(:browser)  { fake_browser }
  let(:assignee) { create(:user, organization: org) }
  let(:work_order) do
    ActsAsTenant.with_tenant(org) {
      create(:work_order, organization: org, requester: create(:user, organization: org), assignee: assignee,
title: "Pump 3 is leaking")
    }
  end

  def subscribe(user, browser = fake_browser)
    PushSubscription.create!(user: user, endpoint: browser.endpoint, p256dh: browser.p256dh, auth: browser.auth)
  end

  def pushes = enqueued_jobs.select { |job| job["job_class"] == "PushNotificationJob" }

  before { stub_push_dns }

  it "pushes an assignment to the assignee, with the work order's number and title and the page to open" do
    subscribe(assignee)

    expect { NotifyAssigneeJob.perform_now(work_order.id) }.to have_enqueued_job(PushNotificationJob)
      .with(assignee.id, title: "Assigned to you: #{work_order.work_order_number}", body: "Pump 3 is leaking",
                         url: "/work-orders/#{work_order.id}", tag: "wo_assigned")
  end

  it "pushes even when the person turned the email off, and not when they turned the push off" do
    subscribe(assignee)
    assignee.update_email_preferences!("email_enabled" => false)
    expect { NotifyAssigneeJob.perform_now(work_order.id) }.to have_enqueued_job(PushNotificationJob)

    assignee.update_email_preferences!("push_enabled" => false)
    expect { NotifyAssigneeJob.perform_now(work_order.id) }.not_to have_enqueued_job(PushNotificationJob)
  end

  it "pushes nothing to a person with no browser subscribed, and still sends the email" do
    expect { NotifyAssigneeJob.perform_now(work_order.id) }.to have_enqueued_mail(WorkOrderMailer, :assigned)
    expect(pushes).to be_empty
  end

  it "pushes to the managers who want it when a work order needs verifying, and to no technician" do
    manager = create(:user, :manager, organization: org)
    subscribe(manager)
    subscribe(assignee)

    NotifyManagerJob.perform_now(work_order.id)

    expect(pushes.map { |job| job["arguments"].first }).to eq([manager.id])
  end

  it "pushes a finished work order to the person who asked for it" do
    requester = work_order.requester
    subscribe(requester)

    expect {
      NotifyRequesterJob.perform_now(work_order.id)
    }.to have_enqueued_job(PushNotificationJob).with(requester.id,
hash_including(tag: "wo_verified"))
  end

  it "pushes a new problem report to the managers" do
    manager = create(:user, :manager, organization: org)
    subscribe(manager)

    expect {
      NotifyNewRequestJob.perform_now(work_order.id)
    }.to have_enqueued_job(PushNotificationJob).with(manager.id,
hash_including(tag: "wo_new_request"))
  end

  it "pushes a part running low to the managers" do
    manager = create(:user, :manager, organization: org)
    subscribe(manager)
    part = ActsAsTenant.with_tenant(org) { create(:part, organization: org, name: "Belt", quantity_on_hand: 2, reorder_point: 5) }

    LowStockAlertJob.perform_now(part.id, "low")

    expect(pushes.map { |job| job["arguments"].last }).to contain_exactly(hash_including("title" => "Running low: Belt",
                                                                                        "body" => "2.0 left (reorder at 5.0)",
                                                                                        "url" => "/parts"))
  end

  it "does not break the thing that caused it when the queue is down" do
    subscribe(assignee)
    allow(PushNotificationJob).to receive(:perform_later).and_raise(Redis::CannotConnectError)

    expect { NotifyAssigneeJob.perform_now(work_order.id) }.not_to raise_error
  end

  it "does the delivery in the job: the browser gets a message it can read" do
    subscribe(assignee, browser)
    request = nil
    stub_request(:post, browser.endpoint).to_return { |req|
      request = req
      { status: 201 }
    }

    perform_enqueued_jobs(only: PushNotificationJob) { NotifyAssigneeJob.perform_now(work_order.id) }

    expect(JSON.parse(browser.decrypt(request.body))).to include("title" => "Assigned to you: #{work_order.work_order_number}",
                                                                 "url" => "/work-orders/#{work_order.id}")
  end

  it "sends nothing for a person who has been deactivated since" do
    subscribe(assignee, browser)
    stub = stub_request(:post, browser.endpoint)
    assignee.update!(deactivated_at: Time.current)

    PushNotificationJob.perform_now(assignee.id, title: "x", body: "y", url: "/", tag: "t")

    expect(stub).not_to have_been_requested
  end
end
