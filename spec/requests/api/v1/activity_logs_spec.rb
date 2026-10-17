require "rails_helper"

RSpec.describe "GET /api/v1/activity_logs", type: :request do
  let(:org)     { create(:organization) }
  let(:manager) { create(:user, :manager, organization: org) }
  let(:tech)    { create(:user, organization: org) }

  # Creating the people and signing in write audit lines of their own (see spec/models/auditable_spec.rb); these specs
  # are about reading and filtering, so they look at the two lines made here.
  let(:mine) { %w[work_order.completed asset.updated] }

  before do
    Auditable.silenced do
      create(:activity_log, organization: org, user: manager,
             action: "work_order.completed", resource_type: "WorkOrder", resource_id: 1)
      create(:activity_log, organization: org, user: tech,
             action: "asset.updated", resource_type: "Asset", resource_id: 2)
    end
  end

  def listed = response.parsed_body["activity_logs"].select { |log| mine.include?(log["action"]) }

  describe "as manager" do
    let(:headers) { auth_headers_for(manager) }

    it "returns paginated activity logs" do
      get "/api/v1/activity_logs", headers: headers, as: :json

      expect(response).to have_http_status(:ok)
      body = response.parsed_body
      expect(body).to have_key("activity_logs")
      expect(listed.size).to eq(2)
    end

    it "filters by resource_type" do
      get "/api/v1/activity_logs",
        params: { resource_type: "WorkOrder" },
        headers: headers

      expect(response.parsed_body["activity_logs"].size).to eq(1)
    end

    it "filters by action" do
      get "/api/v1/activity_logs",
        params: { log_action: "work_order.completed" },
        headers: headers

      expect(response.parsed_body["activity_logs"].size).to eq(1)
    end

    it "filters by user_id" do
      get "/api/v1/activity_logs",
        params: { user_id: tech.id },
        headers: headers

      expect(response.parsed_body["activity_logs"].size).to eq(1)
    end

    it "does not return logs from another org" do
      other = create(:activity_log, action: "work_order.created")
      get "/api/v1/activity_logs", headers: headers, as: :json
      expect(response.parsed_body["activity_logs"].pluck("id")).not_to include(other.id)
      expect(listed.size).to eq(2)
    end
  end

  describe "as technician" do
    it "is forbidden" do
      get "/api/v1/activity_logs", headers: auth_headers_for(tech), as: :json
      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "filtering by what happened and by name" do
    let(:headers) { auth_headers_for(manager) }
    let(:known) { %w[asset.created location.created api_key.revoked asset.updated] }

    def line(action, type, name, **more)
      create(:activity_log, organization: org, user: manager, action: action, resource_type: type, resource_name: name, **more)
    end

    before do
      Auditable.silenced do
        line("asset.created", "Asset", "Boiler 1")
        line("location.created", "Location", "Plant 50%")
        line("api_key.revoked", "ApiKey", "Line_2 key")
      end
    end

    def actions(**params)
      get "/api/v1/activity_logs", params: params, headers: headers
      response.parsed_body["activity_logs"].pluck("action") & known
    end

    it "keeps lines that end in the verb asked for, whatever they are about" do
      expect(actions(verb: "created")).to contain_exactly("asset.created", "location.created")
      expect(actions(verb: "revoked")).to eq(["api_key.revoked"])
    end

    it "ignores a verb it does not know instead of failing or guessing" do
      expect(actions(verb: "x%' OR 1=1 --")).to include("asset.created", "api_key.revoked")
    end

    it "searches the name of the record, ignoring case, and treats % and _ as ordinary characters" do
      expect(actions(q: "boiler")).to eq(["asset.created"])
      expect(actions(q: "50%")).to eq(["location.created"])
      expect(actions(q: "line_2")).to eq(["api_key.revoked"])
      expect(actions(q: "%")).to eq(["location.created"])
    end

    it "finds the lines of a person by part of their name or email, ignoring case" do
      ada = create(:user, :admin, organization: org, first_name: "Ada", last_name: "Lovelace", email: "ada@acme.test")
      Auditable.silenced { line("asset.updated", "Asset", "By Ada").update!(user: ada) }
      expect(actions(person: "lovel")).to eq(["asset.updated"])
      expect(actions(person: "ADA@acme")).to eq(["asset.updated"])
      expect(actions(person: "nobody")).to eq([])
    end

    it "takes a date on its own for \"to\" as the whole day, so the last day is not lost" do
      Auditable.silenced { line("asset.updated", "Asset", "Pump", created_at: Time.zone.parse("2026-10-05 18:30")) }
      expect(actions(to: "2026-10-05", from: "2026-10-05")).to eq(["asset.updated"])
      expect(actions(to: "2026-10-04", from: "2026-10-01")).to eq([])
    end
  end

  describe "as a file" do
    let(:headers) { auth_headers_for(manager) }
    let(:formula) { "=HYPERLINK(\"http://evil.test\")" }

    before do
      Auditable.silenced do
        create(:activity_log, organization: org, user: manager, action: "asset.updated", resource_type: "Asset",
                              resource_name: formula, metadata: { "changed" => %w[name status] })
        create(:activity_log, organization: org, user: nil, action: "work_order.created", resource_type: "WorkOrder",
                              resource_name: "WO-1, \"urgent\"")
      end
    end

    def download(**params)
      get "/api/v1/activity_logs.csv", params: params, headers: headers
      CSV.parse(response.body.delete_prefix("\uFEFF"), headers: true)
    end

    it "is a spreadsheet of the same list, with who, what, which record, which fields and from where" do
      table = download(log_action: "asset.updated")
      expect(response.media_type).to eq("text/csv")
      expect(response.headers["Content-Disposition"]).to include("audit_log_")
      expect(table.headers).to eq(%w[when who email what record record_type fields_changed ip_address])
      expect(table.first.to_h).to include("who" => manager.full_name, "email" => manager.email, "what" => "asset.updated",
                                          "record_type" => "Asset", "fields_changed" => "name; status")
    end

    it "makes text a spreadsheet would run as a formula plain text" do
      expect(download(log_action: "asset.updated").first["record"]).to eq("'#{formula}")
    end

    it "keeps commas and quotes in a name inside its cell, and says System when no person did it" do
      row = download(log_action: "work_order.created").first
      expect(row.to_h).to include("record" => "WO-1, \"urgent\"", "who" => "System", "email" => nil)
    end

    it "applies the same filters as the screen" do
      expect(download(resource_type: "WorkOrder", log_action: "work_order.created").size).to eq(1)
    end

    it "says when it was cut at the limit, and holds the newest lines" do
      stub_const("Api::V1::ActivityLogsController::MAX_EXPORT_ROWS", 1)
      table = download
      expect(response.headers["X-Export-Truncated"]).to eq("true")
      expect(table.size).to eq(1)
    end

    it "does not say it was cut when it was not" do
      download(log_action: "asset.updated")
      expect(response.headers["X-Export-Truncated"]).to be_nil
    end

    it "is for managers and administrators only" do
      get "/api/v1/activity_logs.csv", headers: auth_headers_for(tech)
      expect(response).to have_http_status(:forbidden)
    end
  end
end
