require "rails_helper"

RSpec.describe "Api::V1::SavedReports", type: :request do
  let(:org)        { create(:organization) }
  let(:admin)      { create(:user, :admin, organization: org) }
  let(:manager)    { create(:user, :manager, organization: org, first_name: "Mia", last_name: "Manager") }
  let(:other)      { create(:user, :manager, organization: org) }
  let(:technician) { create(:user, organization: org) }
  let(:requester)  { create(:user, :requester, organization: org) }

  def send_json(verb, url, body = nil, as: manager)
    public_send(verb, url, params: body&.to_json, headers: auth_headers_for(as).merge("Content-Type" => "application/json"))
  end

  describe "GET /saved_reports" do
    before do
      create(:saved_report, organization: org, user: manager, name: "beta")
      create(:saved_report, organization: org, user: other, name: "Alpha", report: "asset_health")
      create(:saved_report, name: "Elsewhere")
    end

    it "lists the company's saved reports by name for any manager, with who made them and whether the asker can change them" do
      send_json :get, "/api/v1/saved_reports"

      expect(response).to have_http_status(:ok)
      expect(json_body["saved_reports"].pluck("name")).to eq(%w[Alpha beta])
      mine = json_body["saved_reports"].find { |r| r["name"] == "beta" }
      theirs = json_body["saved_reports"].find { |r| r["name"] == "Alpha" }
      expect(mine).to include("editable" => true, "owner" => { "id" => manager.id, "full_name" => "Mia Manager" },
"title" => "Work orders")
      expect(theirs["editable"]).to be(false)
    end

    it "names who a report can be emailed to: the company's active managers and administrators" do
      create(:user, organization: org) # a technician
      create(:user, :manager, organization: org, deactivated_at: 1.day.ago)
      send_json :get, "/api/v1/saved_reports"

      expect(json_body["eligible_recipients"].pluck("id")).to contain_exactly(manager.id, other.id)
      expect(json_body["eligible_recipients"].first.keys).to contain_exactly("id", "full_name", "role")
    end

    it "shows an administrator every one as editable" do
      send_json :get, "/api/v1/saved_reports", as: admin

      expect(json_body["saved_reports"].pluck("editable")).to all(be(true))
    end

    it "can be asked for one report" do
      send_json :get, "/api/v1/saved_reports?report=asset_health"

      expect(json_body["saved_reports"].pluck("name")).to eq(["Alpha"])
    end

    it "is for managers and administrators" do
      [technician, requester].each do |person|
        send_json :get, "/api/v1/saved_reports", as: person
        expect(response).to have_http_status(:forbidden)
      end
    end
  end

  describe "POST /saved_reports" do
    let(:body) do
      { saved_report: { name: "Weekly review", report: "work_orders", period: "last_7_days",
                        filters: { priorities: %w[high critical], asset_ids: [1, 2], junk: "x" },
                        send_on: 1, recipient_ids: [manager.id, other.id] } }
    end

    it "saves it as the person asking, with the filters tidied and the people named" do
      create(:user, :admin, organization: org) # an older account in the company, who is not the one asking
      send_json :post, "/api/v1/saved_reports", body

      expect(response).to have_http_status(:created)
      expect(json_body["data"]).to include("name" => "Weekly review", "period" => "last_7_days", "send_on" => 1,
                                           "filters" => { "asset_ids" => [1, 2], "priorities" => %w[high critical] },
                                           "recipient_ids" => [manager.id, other.id])
      expect(json_body["data"]["recipients"].pluck("id")).to contain_exactly(manager.id, other.id)
      expect(SavedReport.last.user).to eq(manager)
    end

    it "needs no schedule" do
      send_json :post, "/api/v1/saved_reports", { saved_report: { name: "Just filters", report: "pm_compliance" } }

      expect(response).to have_http_status(:created)
      expect(json_body["data"]).to include("send_on" => nil, "recipient_ids" => [], "period" => "last_30_days")
    end

    it "says what is wrong and saves nothing" do
      send_json :post, "/api/v1/saved_reports", { saved_report: { name: "", report: "downtime" } }
      expect(response).to have_http_status(:unprocessable_entity)

      send_json :post, "/api/v1/saved_reports", { saved_report: body[:saved_report].merge(recipient_ids: [technician.id]) }
      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body.dig("error", "message")).to include("managers and administrators")

      send_json :post, "/api/v1/saved_reports", { saved_report: body[:saved_report].merge(recipient_ids: []) }
      expect(json_body.dig("error", "message")).to include("at least one person")
      expect(SavedReport.count).to eq(0)
    end

    it "refuses a name that is taken for that report" do
      send_json :post, "/api/v1/saved_reports", body
      send_json :post, "/api/v1/saved_reports", body

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "is for managers and administrators" do
      send_json :post, "/api/v1/saved_reports", body, as: technician

      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "PATCH /saved_reports/:id" do
    let!(:saved) { create(:saved_report, organization: org, user: manager, name: "Mine") }

    it "lets the person who saved it change the name, period, filters and schedule" do
      send_json :patch, "/api/v1/saved_reports/#{saved.id}",
                { saved_report: { name: "Renamed", period: "last_month", filters: { sources: ["pm"] }, send_on: 5,
                                  recipient_ids: [other.id] } }

      expect(response).to have_http_status(:ok)
      expect(saved.reload).to have_attributes(name: "Renamed", period: "last_month", filters: { "sources" => ["pm"] }, send_on: 5,
                                              recipient_ids: [other.id], user: manager)
    end

    it "does not move it to another report" do
      send_json :patch, "/api/v1/saved_reports/#{saved.id}", { saved_report: { report: "asset_health", name: "Same" } }

      expect(saved.reload.report).to eq("work_orders")
    end

    it "turns the emailing off" do
      saved.update!(send_on: 1, recipient_ids: [manager.id])
      send_json :patch, "/api/v1/saved_reports/#{saved.id}", { saved_report: { send_on: nil, recipient_ids: [] } }

      expect(saved.reload).to have_attributes(send_on: nil, recipient_ids: [])
    end

    it "is for whoever saved it, and administrators" do
      send_json :patch, "/api/v1/saved_reports/#{saved.id}", { saved_report: { name: "Hijacked" } }, as: other
      expect(response).to have_http_status(:forbidden)

      send_json :patch, "/api/v1/saved_reports/#{saved.id}", { saved_report: { name: "By admin" } }, as: admin
      expect(response).to have_http_status(:ok)
      expect(saved.reload.name).to eq("By admin")
    end

    it "does not reach another company's" do
      send_json :patch, "/api/v1/saved_reports/#{create(:saved_report).id}", { saved_report: { name: "x" } }

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "DELETE /saved_reports/:id" do
    let!(:saved) { create(:saved_report, organization: org, user: manager) }

    it "deletes it for whoever saved it, and for an administrator, not for another manager" do
      send_json :delete, "/api/v1/saved_reports/#{saved.id}", as: other
      expect(response).to have_http_status(:forbidden)
      expect(SavedReport.exists?(saved.id)).to be(true)

      send_json :delete, "/api/v1/saved_reports/#{saved.id}"
      expect(response).to have_http_status(:no_content)
      expect(SavedReport.exists?(saved.id)).to be(false)
    end
  end

  describe "POST /saved_reports/:id/send_now" do
    let!(:saved) do
      create(:saved_report, organization: org, user: other, name: "Theirs", send_on: 1, recipient_ids: [other.id],
filters: { priorities: ["high"] })
    end

    before { ActionMailer::Base.deliveries.clear }

    it "emails the PDF to the person asking only, whoever saved it, and leaves the schedule alone" do
      send_json :post, "/api/v1/saved_reports/#{saved.id}/send_now"

      expect(response).to have_http_status(:ok)
      expect(json_body["sent_to"]).to eq(manager.email)
      expect(ActionMailer::Base.deliveries.flat_map(&:to)).to eq([manager.email])
      expect(ActionMailer::Base.deliveries.first.attachments.first.filename).to end_with(".pdf")
      expect(saved.reload).to have_attributes(last_sent_on: nil, last_sent_at: nil)
    end

    it "works for a saved report that is not emailed on a schedule, and says the copy was asked for" do
      unscheduled = create(:saved_report, organization: org, user: other, name: "No schedule")
      send_json :post, "/api/v1/saved_reports/#{unscheduled.id}/send_now"

      expect(response).to have_http_status(:ok)
      body = ActionMailer::Base.deliveries.first.body.parts.first.body.to_s
      expect(body).to include("You asked for this copy yourself", "No schedule")
      expect(body).not_to include("set this up to be emailed")
    end

    it "says who set up a scheduled one, and when it is sent" do
      send_json :post, "/api/v1/saved_reports/#{saved.id}/send_now"

      body = ActionMailer::Base.deliveries.first.body.parts.first.body.to_s
      expect(body).to include("set this up to be emailed every Monday to one person")
    end

    it "says why when the report cannot be made" do
      other.update!(role: "technician")
      send_json :post, "/api/v1/saved_reports/#{saved.id}/send_now"

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body["error"]).to include("code" => "REPORT_FAILED")
      expect(ActionMailer::Base.deliveries).to be_empty
    end

    it "is for managers and administrators" do
      send_json :post, "/api/v1/saved_reports/#{saved.id}/send_now", as: technician

      expect(response).to have_http_status(:forbidden)
    end
  end
end
