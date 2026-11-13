require "rails_helper"

RSpec.describe "Plugin reports", type: :request do
  let(:org)     { create(:organization) }
  let(:manager) { create(:user, :manager, organization: org) }

  before { install_plugins("demo" => PluginHelpers::GOOD_PLUGIN) }

  def switch_on(organization = org) = Plugins::Settings.for(organization).set_enabled("demo", true)

  def fetch(path = "/api/v1/plugin_reports/demo/things", as: manager,
            **params)
    get(path, params: params, headers: auth_headers_for(as))
  end

  def table = json_body["table"]

  describe "who may" do
    it "is for managers and administrators, like the reports built in" do
      switch_on
      [create(:user, organization: org), create(:user, :requester, organization: org)].each do |person|
        fetch(as: person)
        expect(response).to have_http_status(:forbidden)
        fetch("/api/v1/plugin_reports", as: person)
        expect(response).to have_http_status(:forbidden)
      end
      fetch(as: create(:user, :admin, organization: org))
      expect(response).to have_http_status(:ok)
    end

    it "needs a sign-in" do
      get "/api/v1/plugin_reports"

      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "GET /api/v1/plugin_reports" do
    it "lists the reports of the plugins the company switched on, and nothing before that" do
      fetch("/api/v1/plugin_reports")
      expect(json_body["reports"]).to eq([])

      switch_on
      fetch("/api/v1/plugin_reports")

      expect(json_body["reports"]).to eq([{ "plugin" => "demo", "plugin_title" => "Demo", "key" => "things", "title" => "Things",
                                            "description" => "All the things", "period" => true }])
    end

    it "keeps the companies apart" do
      switch_on(create(:organization))

      fetch("/api/v1/plugin_reports")

      expect(json_body["reports"]).to eq([])
    end
  end

  describe "GET /api/v1/plugin_reports/:plugin/:report" do
    it "answers with the table the plugin made, for the company asking" do
      switch_on

      fetch

      expect(response).to have_http_status(:ok)
      expect(json_body["report"]).to include("plugin" => "demo", "key" => "things", "title" => "Things")
      expect(table["columns"]).to eq([{ "key" => "name", "label" => "Name", "kind" => "text" },
                                      { "key" => "count", "label" => "Count", "kind" => "number" }])
      expect(table["rows"]).to eq([[org.name, 3]])
    end

    it "is switched off for a company until its administrator switches the plugin on" do
      fetch

      expect(response).to have_http_status(:not_found)
      expect(json_body["error"]).to include("code" => "PLUGIN_OFF")
      expect(json_body["error"]["message"]).to include("Settings, Plugins")
    end

    it "says not found for a report or a plugin that does not exist" do
      switch_on
      fetch("/api/v1/plugin_reports/demo/nothing")
      expect(response).to have_http_status(:not_found)

      fetch("/api/v1/plugin_reports/nothing/things")
      expect(response).to have_http_status(:not_found)
    end

    describe "the period" do
      def period_plugin(period:, code:)
        install_plugins("demo" => %(Plugins.define("demo") { title "Demo"; api 1; report("things", title: "T", period: #{period}) { |context| #{code} } })) # rubocop:disable Layout/LineLength
        switch_on
      end

      it "is the last 30 days when none is given, each end a whole day in the company's time" do
        period_plugin(period: true, code: '{ columns: [{ key: "a" }], rows: [[context.from.iso8601], [context.to.iso8601]] }')
        travel_to(Time.zone.parse("2026-11-11 15:00")) { fetch }

        from, to = table["rows"].flatten.map { |text| Time.zone.parse(text) }
        expect(from).to eq(Time.zone.parse("2026-10-12").beginning_of_day)
        expect(to).to eq(Time.zone.parse("2026-11-11").end_of_day.change(usec: 0))
        expect(json_body["from"]).to be_present
      end

      it "takes dates on their own as whole days" do
        period_plugin(period: true, code: '{ columns: [{ key: "a" }], rows: [[context.from.iso8601], [context.to.iso8601]] }')

        fetch(from: "2026-11-01", to: "2026-11-03")

        from, to = table["rows"].flatten.map { |text| Time.zone.parse(text) }
        expect(from).to eq(Time.zone.parse("2026-11-01").beginning_of_day)
        expect(to).to eq(Time.zone.parse("2026-11-03").end_of_day.change(usec: 0))
      end

      it "is not given to a report that says period: false" do
        period_plugin(period: false, code: '{ columns: [{ key: "a" }], rows: [[context.from.inspect + context.to.inspect]] }')

        fetch(from: "2026-11-01", to: "2026-11-03")

        expect(table["rows"]).to eq([["nilnil"]])
        expect(json_body["from"]).to be_nil
        expect(json_body["report"]["period"]).to be(false)
      end

      it "refuses a period that ends before it starts, and dates that are not dates" do
        switch_on
        fetch(from: "2026-11-05", to: "2026-11-01")
        expect(response).to have_http_status(:bad_request)

        fetch(from: "not a date")
        expect(response).to have_http_status(:bad_request)
      end
    end

    it "gives the plugin any other values on the address" do
      install_plugins("demo" => PluginHelpers::GOOD_PLUGIN.sub('"count" => 3', '"count" => context.params["limit"].to_i'))
      switch_on

      fetch(limit: "12")

      expect(table["rows"]).to eq([[org.name, 12]])
    end

    it "gives the plugin the company of the person asking, not another one" do
      create(:organization, name: "An earlier company")
      switch_on

      fetch

      expect(table["rows"]).to eq([[org.name, 3]])
    end

    it "lets the plugin read only this company's records" do
      install_plugins("demo" => PluginHelpers::GOOD_PLUGIN.sub('"count" => 3', '"count" => Asset.count'))
      switch_on
      create(:asset, organization: org)
      create(:asset, organization: create(:organization))

      fetch

      expect(table["rows"]).to eq([[org.name, 1]])
    end

    describe "as a spreadsheet" do
      it "downloads the same table as CSV, named for the plugin and report" do
        switch_on

        get "/api/v1/plugin_reports/demo/things.csv", headers: auth_headers_for(manager)

        expect(response).to have_http_status(:ok)
        expect(response.media_type).to eq("text/csv")
        expect(response.headers["Content-Disposition"]).to include("demo_things_#{Time.zone.today}.csv")
        expect(CSV.parse(response.body.delete_prefix(ExportService::BYTE_ORDER_MARK))).to eq([%w[Name Count], [org.name, "3"]])
      end

      it "does not offer a format it has not got" do
        switch_on

        get "/api/v1/plugin_reports/demo/things.pdf", headers: auth_headers_for(manager)

        expect(response).to have_http_status(:not_acceptable)
      end
    end

    it "says what went wrong when the plugin's report fails, and keeps the server answering" do
      install_plugins("demo" => PluginHelpers::GOOD_PLUGIN.sub('"count" => 3', '"count" => 1 / 0'))
      switch_on
      allow(Rails.logger).to receive(:error)

      fetch

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body["error"]).to include("code" => "PLUGIN_REPORT_FAILED", "message" => a_string_including("ZeroDivisionError"))
      fetch("/api/v1/plugin_reports")
      expect(response).to have_http_status(:ok)
    end
  end
end
