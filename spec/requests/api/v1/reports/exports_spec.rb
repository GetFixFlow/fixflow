require "rails_helper"

# The Export menus on the report pages: the same request as the screen's, with .csv or .pdf on the end.
RSpec.describe "Report exports", type: :request do
  let(:org)        { create(:organization, name: "Acme Plant") }
  let(:manager)    { create(:user, :manager, organization: org) }
  let(:technician) { create(:user, organization: org, first_name: "Tina", last_name: "Tech") }
  let(:plant)      { create(:location, organization: org, name: "Plant") }
  let(:annex)      { create(:location, organization: org, name: "Annex") }
  let(:pump)       { create(:asset, organization: org, name: "Pump", location: plant) }
  let(:fan)        { create(:asset, organization: org, name: "Fan", location: annex) }

  def range = { from: 10.days.ago.to_date.iso8601, to: Time.current.to_date.iso8601 }

  def download(path, as: manager, **params)
    get "/api/v1/reports/#{path}", params: range.merge(params), headers: auth_headers_for(as)
  end

  def csv_rows
    CSV.parse(response.body.delete_prefix("﻿"), headers: true)
  end

  def pdf_text
    PDF::Reader.new(StringIO.new(response.body)).pages.map(&:text).join("\n")
  end

  def work_order(**attrs)
    create(:work_order, organization: org, asset: pump, created_at: 3.days.ago, **attrs)
  end

  describe "work orders" do
    let!(:high) { work_order(title: "Pump leaking", priority: "high", assignee: technician, labor_cost: 100, parts_cost: 20) }

    before do
      work_order(title: "Paint the fan guard", priority: "low", asset: fan)
      work_order(title: "Last quarter's job", created_at: 100.days.ago)
      create(:work_order, title: "Someone else's", organization: create(:organization), created_at: 2.days.ago)
    end

    it "lists the work orders behind the figures as a CSV file named for the day" do
      download("work_orders/summary.csv")

      expect(response).to have_http_status(:ok)
      expect(response.content_type).to include("text/csv")
      expect(response.headers["Content-Disposition"]).to include("work_orders_#{Time.zone.today}.csv")
      expect(csv_rows.pluck("title")).to contain_exactly("Pump leaking", "Paint the fan guard")
      row = csv_rows.find { |r| r["title"] == "Pump leaking" }
      expect(row.to_h).to include("work_order_number" => high.work_order_number, "priority" => "high", "asset" => "Pump",
                                  "assignee" => "Tina Tech", "labor_cost" => "100.0", "parts_cost" => "20.0", "total_cost" => "120.0")
    end

    it "holds only the period asked for" do
      download("work_orders/summary.csv", from: 200.days.ago.to_date.iso8601)

      expect(csv_rows.pluck("title")).to include("Last quarter's job")
    end

    it "holds only what the filters choose, as the screen does" do
      download("work_orders/summary.csv", "priorities" => ["high"])
      expect(csv_rows.pluck("title")).to eq(["Pump leaking"])

      download("work_orders/summary.csv", "location_ids" => [annex.id])
      expect(csv_rows.pluck("title")).to eq(["Paint the fan guard"])

      download("work_orders/summary.csv", "user_ids" => [technician.id])
      expect(csv_rows.pluck("title")).to eq(["Pump leaking"])
    end

    it "never holds another company's work orders" do
      download("work_orders/summary.csv", from: 30.days.ago.to_date.iso8601)

      expect(response.body).not_to include("Someone else's")
    end

    it "keeps text a spreadsheet would run as a formula as plain text (anyone can name a work order, via the public form)" do
      work_order(title: "=HYPERLINK(\"http://evil.example\",\"click\")")

      download("work_orders/summary.csv")

      titles = csv_rows.pluck("title")
      expect(titles).to include("'=HYPERLINK(\"http://evil.example\",\"click\")")
      expect(titles.grep(/\A=/)).to be_empty
    end

    it "says when the file is cut short, and is not otherwise" do
      stub_const("Api::V1::Reports::BaseController::MAX_EXPORT_ROWS", 1)

      download("work_orders/summary.csv")
      expect(response.headers["X-Export-Truncated"]).to eq("true")
      expect(csv_rows.size).to eq(1)

      stub_const("Api::V1::Reports::BaseController::MAX_EXPORT_ROWS", 2)
      download("work_orders/summary.csv")
      expect(response.headers["X-Export-Truncated"]).to be_nil
      expect(csv_rows.size).to eq(2)
    end

    it "makes a PDF of the summary with the company name and the figures" do
      download("work_orders/summary.pdf")

      expect(response).to have_http_status(:ok)
      expect(response.content_type).to include("application/pdf")
      expect(response.headers["Content-Disposition"]).to include("work_orders_#{Time.zone.today}.pdf")
      expect(response.body).to start_with("%PDF")
      expect(pdf_text).to include("Acme Plant", "Work Order Summary Report")
    end

    it "still answers JSON as before" do
      download("work_orders/summary")

      expect(response.content_type).to include("application/json")
      expect(json_body["totals"]["created"]).to eq(2)
    end
  end

  describe "asset health" do
    before do
      pump
      create(:asset, organization: org, name: "Press", location: annex, status: "down")
    end

    it "writes a row for each place with a value in every column" do
      download("assets/health.csv")

      expect(csv_rows.headers).to eq(%w[location total operational degraded down health_score])
      expect(csv_rows.map(&:to_h)).to contain_exactly(
        include("location" => "Plant", "total" => "1", "operational" => "1", "down" => "0"),
        include("location" => "Annex", "total" => "1", "operational" => "0", "down" => "1")
      )
    end

    it "makes a PDF" do
      download("assets/health.pdf")

      expect(response.body).to start_with("%PDF")
      expect(pdf_text).to include("Acme Plant", "Asset Health Report")
    end

    it "does not give a filtered request the answer to another (the cache is kept by what was asked)" do
      allow(Rails).to receive(:cache).and_return(ActiveSupport::Cache::MemoryStore.new)

      download("assets/health")
      all_assets = json_body["total"]
      download("assets/health", location_id: annex.id)

      expect(all_assets).to eq(2)
      expect(json_body["total"]).to eq(1)
    end
  end

  describe "preventive maintenance compliance" do
    before do
      [pump, fan].each do |asset|
        pm = create(:preventive_maintenance, organization: org, asset: asset)
        create(:pm_execution, preventive_maintenance: pm, status: :completed, scheduled_date: 5.days.ago.to_date)
      end
    end

    it "writes a row for each month" do
      download("pm/compliance.csv")

      expect(csv_rows.headers).to eq(%w[month scheduled completed skipped compliance_rate])
      expect(csv_rows.sum { |row| row["scheduled"].to_i }).to eq(2)
      expect(csv_rows.sum { |row| row["completed"].to_i }).to eq(2)
    end

    it "makes a PDF" do
      download("pm/compliance.pdf")

      expect(response.body).to start_with("%PDF")
      expect(pdf_text).to include("Acme Plant", "PM Compliance Report")
    end

    it "does not give a filtered request the answer to another" do
      allow(Rails).to receive(:cache).and_return(ActiveSupport::Cache::MemoryStore.new)

      download("pm/compliance")
      everything = json_body.dig("summary", "scheduled")
      download("pm/compliance", location_id: annex.id)

      expect(everything).to eq(2)
      expect(json_body.dig("summary", "scheduled")).to eq(1)
    end
  end

  describe "technician performance" do
    before do
      work_order(assignee: technician, status: "completed", completed_at: 1.day.ago, completion_notes: "Done")
    end

    it "writes each person's figures" do
      download("work_orders/technician_performance.csv")

      row = csv_rows.find { |r| r["name"] == "Tina Tech" }
      expect(row.to_h).to include("assigned" => "1", "completed" => "1", "completion_rate" => "100.0")
    end

    it "has no PDF, and says so rather than sending something else" do
      download("work_orders/technician_performance.pdf")

      expect(response).to have_http_status(:not_acceptable)
      expect(json_body.dig("error", "code")).to eq("UNSUPPORTED_FORMAT")
    end
  end

  describe "costs" do
    before do
      create(:work_order, :completed, organization: org, asset: pump, labor_cost: 100, parts_cost: 20, completed_at: 2.days.ago)
      create(:work_order, :completed, organization: org, asset: fan, labor_cost: 0, parts_cost: 40, completed_at: 2.days.ago)
    end

    it "writes the cost of each asset" do
      download("costs/by_asset.csv")

      expect(csv_rows.map(&:to_h)).to contain_exactly(
        include("asset" => "Pump", "labor_cost" => "100.0", "parts_cost" => "20.0", "total_cost" => "120.0", "work_orders" => "1"),
        include("asset" => "Fan", "labor_cost" => "0.0", "parts_cost" => "40.0", "total_cost" => "40.0", "work_orders" => "1")
      )
    end

    it "holds every asset, though the screen shows only the dearest 20" do
      22.times do |n|
        create(:work_order, :completed, organization: org, asset: create(:asset, organization: org, name: "Asset #{n}"),
                                        labor_cost: 10, parts_cost: 0, completed_at: 2.days.ago)
      end

      download("costs/by_asset")
      expect(json_body["assets"].size).to eq(20)
      download("costs/by_asset.csv")

      expect(csv_rows.size).to eq(24)
    end

    it "writes the cost of each place" do
      download("costs/by_location.csv")

      expect(csv_rows.map { |row| [row["location"], row["total_cost"]] }).to contain_exactly(%w[Plant 120.0], %w[Annex 40.0])
    end

    it "has no PDF" do
      download("costs/by_asset.pdf")

      expect(response).to have_http_status(:not_acceptable)
    end
  end

  describe "the period" do
    it "includes the whole of the last day when only a date is given, as the screens send it" do
      work_order(title: "Made this morning", created_at: Time.zone.now.beginning_of_day + 1.minute)
      today = Time.zone.today.iso8601

      get "/api/v1/reports/work_orders/summary", params: { from: today, to: today }, headers: auth_headers_for(manager)
      expect(json_body.dig("totals", "created")).to eq(1)

      get "/api/v1/reports/work_orders/summary.csv", params: { from: today, to: today }, headers: auth_headers_for(manager)
      expect(csv_rows.pluck("title")).to eq(["Made this morning"])
    end

    it "still takes a full time as given" do
      work_order(title: "Later today", created_at: 1.hour.ago)

      get "/api/v1/reports/work_orders/summary", params: { from: 1.day.ago.iso8601, to: 2.hours.ago.iso8601 },
                                                 headers: auth_headers_for(manager)

      expect(json_body.dig("totals", "created")).to eq(0)
    end

    it "counts what finished today in the cost reports" do
      create(:work_order, :completed, organization: org, asset: pump, labor_cost: 10, parts_cost: 5, completed_at: 1.minute.ago)
      today = Time.zone.today.iso8601

      get "/api/v1/reports/costs/summary", params: { from: today, to: today }, headers: auth_headers_for(manager)

      expect(json_body["total_cost"]).to eq(15.0)
    end
  end

  describe "who may export" do
    [
      "work_orders/summary.csv", "work_orders/summary.pdf", "assets/health.csv", "assets/health.pdf",
      "pm/compliance.csv", "pm/compliance.pdf", "work_orders/technician_performance.csv", "costs/by_asset.csv",
      "costs/by_location.csv"
    ].each do |path|
      it "refuses a technician: #{path}" do
        download(path, as: technician)

        expect(response).to have_http_status(:forbidden)
        expect(response.body).not_to include("Pump")
      end

      it "refuses someone not signed in: #{path}" do
        get "/api/v1/reports/#{path}", params: range

        expect(response).to have_http_status(:unauthorized)
      end
    end

    it "answers an unknown format with 406, not data" do
      download("work_orders/summary.xml")

      expect(response).to have_http_status(:not_acceptable)
    end
  end
end
