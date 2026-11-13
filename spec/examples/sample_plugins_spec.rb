require "rails_helper"

# The two plugins in examples/plugins, installed the way an administrator would (copied into the plugins folder), and used
# through the same screens' endpoints. They prove the point of the extension points: a report and a notification channel added
# without a line of FixFlow's own code changing.
RSpec.describe "The sample plugins", type: :request do
  include ActiveJob::TestHelper

  let(:org)     { create(:organization) }
  let(:admin)   { create(:user, :admin, organization: org) }
  let(:manager) { create(:user, :manager, organization: org) }
  let(:ana)     { create(:user, organization: org, first_name: "Ana", last_name: "Perera") }
  let(:ben)     { create(:user, organization: org, first_name: "Ben", last_name: "Silva") }

  before do
    allow(Resolv).to receive(:getaddresses).and_return(["203.0.113.10"])
    install_sample_plugins("overdue_work", "ntfy")
  end

  def switch_on(key) = Plugins::Settings.for(org).set_enabled(key, true)
  def fetch(path, **params) = get(path, params: params, headers: auth_headers_for(manager))

  it "loads both, with nothing wrong, and says what each adds" do
    expect(Plugins.failures).to be_empty
    expect(Plugins.installed.map(&:key)).to eq(%w[ntfy overdue_work])
    expect(Plugins.find("overdue_work").reports.map(&:key)).to eq(%w[overdue_now finished_late])
    expect(Plugins.find("ntfy").channels.map(&:key)).to eq(["ntfy"])
  end

  describe "overdue_work (reports)" do
    before { switch_on("overdue_work") }

    it "shows who has work past its due date right now" do # rubocop:disable RSpec/ExampleLength
      create(:work_order, organization: org, assignee: ana, status: "assigned", priority: "critical", due_date: 5.days.ago)
      create(:work_order, organization: org, assignee: ana, status: "in_progress", due_date: 2.days.ago)
      create(:work_order, organization: org, assignee: ben, status: "open", due_date: 1.day.ago)
      create(:work_order, organization: org, status: "open", due_date: 3.days.ago)
      create(:work_order, :completed, organization: org, assignee: ana, due_date: 4.days.ago, completed_at: 5.days.ago)
      create(:work_order, organization: org, assignee: ben, status: "open", due_date: 3.days.from_now)
      create(:work_order, organization: create(:organization), status: "open", due_date: 3.days.ago) # another company

      fetch("/api/v1/plugin_reports/overdue_work/overdue_now")

      expect(response).to have_http_status(:ok)
      table = json_body["table"]
      expect(table["rows"].map { |row| row.first(3) }).to eq([["Ana Perera", 2, 1], ["Ben Silva", 1, 0], ["Nobody yet", 1, 0]])
      expect(table["rows"].first.last).to start_with(5.days.ago.to_date.iso8601[0, 7])
      expect(table["summary"]).to eq([{ "label" => "Overdue work orders", "kind" => "number", "value" => 4 }])
      expect(json_body["report"]["period"]).to be(false)
    end

    it "shows who finished work late in the period, as a share" do
      create(:work_order, :completed, organization: org, assignee: ana, due_date: 4.days.ago, completed_at: 2.days.ago)
      create(:work_order, :completed, organization: org, assignee: ana, due_date: 1.day.from_now, completed_at: 2.days.ago)
      create(:work_order, :completed, organization: org, assignee: ben, due_date: 1.day.from_now, completed_at: 3.days.ago)
      create(:work_order, :completed, organization: org, assignee: ben, due_date: 10.days.ago, completed_at: 40.days.ago) # too early
      create(:work_order, :completed, organization: org, assignee: ben, completed_at: 2.days.ago, due_date: nil)          # no due date

      fetch("/api/v1/plugin_reports/overdue_work/finished_late", from: 7.days.ago.to_date.iso8601, to: Date.current.iso8601)

      table = json_body["table"]
      expect(table["columns"].pluck("kind")).to eq(%w[text number number percent])
      expect(table["rows"]).to eq([["Ana Perera", 2, 1, 50.0], ["Ben Silva", 1, 0, 0.0]])
      expect(table["summary"].pluck("value")).to eq([3, 1])
    end

    it "downloads either as a spreadsheet" do
      create(:work_order, organization: org, assignee: ana, status: "open", due_date: 2.days.ago)

      get "/api/v1/plugin_reports/overdue_work/overdue_now.csv", headers: auth_headers_for(manager)

      rows = CSV.parse(response.body.delete_prefix(ExportService::BYTE_ORDER_MARK))
      expect(rows.first).to eq(["Assigned to", "Overdue work orders", "High or critical", "Oldest due date"])
      expect(rows.second.first(3)).to eq(["Ana Perera", "1", "0"])
    end

    it "an empty company gets an empty table, not an error" do
      fetch("/api/v1/plugin_reports/overdue_work/overdue_now")
      expect(json_body["table"]["rows"]).to eq([])

      fetch("/api/v1/plugin_reports/overdue_work/finished_late")
      expect(response).to have_http_status(:ok)
    end
  end

  describe "ntfy (a notification channel)" do
    let(:topic) { "workshop-7f3a9c2e1b" }

    def set_up(values = {}, events: %w[wo_assigned iot_alert])
      switch_on("ntfy")
      values = { server: "https://ntfy.example.test", topic: topic }.merge(values)
      problems = Plugins::Settings.for(org.reload).update_channel(Plugins.channel("ntfy", "ntfy"), enabled: true, events: events,
values: values)
      expect(problems).to eq([])
    end

    def announce(event = "wo_assigned")
      ChatNotifier.post(org, event, title: "WO-000012 assigned to Ana", body: "Pump 3",
    path: "/work-orders/12")
    end

    it "turns what FixFlow announces into a push message on the topic" do
      set_up
      sent = stub_request(:post, "https://ntfy.example.test").with { |request|
        JSON.parse(request.body) == { "topic" => topic, "title" => "WO-000012 assigned to Ana", "message" => "Pump 3", "priority" => 3,
                                      "tags" => ["wrench"], "click" => "#{EmailSetup.base_url}/work-orders/12" } &&
          request.headers["Content-Type"] == "application/json" && request.headers["Authorization"].nil?
      }.to_return(status: 200, body: "{}")

      perform_enqueued_jobs { announce }

      expect(sent).to have_been_requested.once
      expect(Plugins::Settings.for(org.reload).channel("ntfy", "ntfy")).to have_attributes(last_error: nil, last_sent_at: be_present)
    end

    it "sends the priority chosen and the access token, and hears only the events ticked" do
      set_up({ priority: "urgent", token: "tk_secret" }, events: %w[iot_alert])
      sent = stub_request(:post, "https://ntfy.example.test").with { |request|
        JSON.parse(request.body)["priority"] == 5 && request.headers["Authorization"] == "Bearer tk_secret"
      }.to_return(status: 200)

      perform_enqueued_jobs do
        announce("wo_assigned")
        announce("iot_alert")
      end

      expect(sent).to have_been_requested.once
    end

    it "is checked from the Settings screen's Test button, and says why a wrong token fails" do
      switch_on("ntfy")
      stub_request(:post, "https://ntfy.example.test").to_return(status: 403)

      post "/api/v1/plugins/ntfy/channels/ntfy/test", headers: auth_headers_for(admin), as: :json,
                                                      params: { channel: { values: { server: "https://ntfy.example.test", topic: topic } } }

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body["error"]["message"]).to eq("The service refused the message (403): the login or token was not accepted.")
    end

    it "keeps a server that is down in the channel's last error, and tries again" do
      set_up
      stub_request(:post, "https://ntfy.example.test").to_return(status: 503)

      expect { perform_enqueued_jobs(only: PluginChannelJob) { announce } }.not_to raise_error

      expect(Plugins::Settings.for(org.reload).channel("ntfy", "ntfy").last_error).to eq("The service answered 503.")
    end

    it "never sends to an address on the server itself" do
      switch_on("ntfy")
      problems = Plugins::Settings.for(org).update_channel(Plugins.channel("ntfy", "ntfy"),
values: { server: "http://127.0.0.1:3000", topic: topic })

      expect(problems).to eq(["Server points at this server or a link-local address."])
    end

    it "needs a topic once it is switched on" do
      switch_on("ntfy")

      problems = Plugins::Settings.for(org).update_channel(Plugins.channel("ntfy", "ntfy"), enabled: true,
values: { server: "https://ntfy.sh" })

      expect(problems).to eq(["Topic is needed."])
    end
  end
end
