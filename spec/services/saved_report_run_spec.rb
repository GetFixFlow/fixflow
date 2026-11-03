require "rails_helper"

RSpec.describe SavedReportRun do
  let(:org)     { create(:organization, name: "Acme Plant") }
  let(:manager) { create(:user, :manager, organization: org) }
  let(:pump)    { create(:asset, organization: org, name: "Pump") }
  let(:today)   { Date.new(2026, 11, 4) }

  def pdf_text(result) = PDF::Reader.new(StringIO.new(result.pdf)).pages.map(&:text).join("\n")

  def make(priority, on, **attrs)
    create(:work_order, organization: org, asset: pump, priority: priority, created_at: on.in_time_zone("UTC") + 10.hours, **attrs)
  end

  def run(**attrs) = described_class.new(create(:saved_report, organization: org, user: manager, **attrs), today: today).call

  it "makes the PDF of the report, named for the report and the last day, headed by the company" do
    result = run(report: "work_orders")

    expect(result.pdf).to start_with("%PDF")
    expect(result.filename).to eq("work_orders_summary_2026-11-03.pdf")
    expect([result.from, result.to]).to eq([Date.new(2026, 10, 5), Date.new(2026, 11, 3)])
    expect(pdf_text(result)).to include("Acme Plant", "Work Order Summary Report")
  end

  it "makes each of the three reports that have a PDF" do
    { "asset_health" => "Asset Health Report", "pm_compliance" => "PM Compliance Report" }.each do |report, title|
      expect(pdf_text(run(report: report, name: report))).to include(title)
    end
  end

  it "counts the period the saved report means, and only that" do
    make("critical", today - 2)
    make("critical", today - 3)
    make("critical", today - 40)
    make("critical", today) # today is not in the last 30 days: the period is the finished days before

    text = pdf_text(run(period: "last_30_days"))
    expect(text).to match(/Critical\s+2\s+/)
  end

  it "applies the filters the way the screen does" do
    make("critical", today - 2)
    make("low", today - 2)
    make("low", today - 3)

    everything = pdf_text(run(name: "all"))
    only_low = pdf_text(run(name: "low only", filters: { "priorities" => ["low"] }))

    expect(everything).to match(/Critical\s+1\s+/).and match(/Low\s+2\s+/)
    expect(only_low).to match(/Low\s+2\s+/)
    expect(only_low).not_to match(/Critical\s+1\s+/)
  end

  it "uses the company's date, not the server's" do
    org.update!(settings: org.settings.merge("timezone" => "Pacific/Auckland"))
    # 4 Nov 11:00 in Auckland is still 3 Nov in UTC: the saved report must read the company's day.
    travel_to(Time.utc(2026, 11, 3, 22, 0)) do
      result = described_class.new(create(:saved_report, organization: org, user: manager, period: "last_7_days")).call

      expect(result.to).to eq(Date.new(2026, 11, 3))
    end
  end

  it "cannot be made as someone who is no longer a manager, or has been deactivated" do
    saved = create(:saved_report, organization: org, user: manager)

    manager.update!(role: "technician")
    expect { described_class.new(saved.reload, today: today).call }.to raise_error(described_class::Failed, /no longer a manager/)

    manager.update!(role: "manager", deactivated_at: Time.current)
    expect { described_class.new(saved.reload, today: today).call }.to raise_error(described_class::Failed, /no longer a manager/)
  end

  it "says why when the report itself refuses, for example when the company requires two-factor and the person has none" do
    org.update!(settings: org.settings.merge("require_two_factor" => true))

    expect { run }.to raise_error(described_class::Failed, /could not be made.*two-factor/i)
  end

  it "makes nothing in the company's name of another company's data" do
    other = create(:organization)
    create(:work_order, organization: other, priority: "critical", created_at: (today - 2).in_time_zone("UTC") + 10.hours)

    expect(pdf_text(run)).not_to match(/Critical\s+1\s+/)
  end

  it "does not leave anyone signed in, and puts back who and what was current before" do
    bystander = create(:user)
    Current.user = bystander
    Current.request_ip = "10.0.0.9"

    expect { run }.not_to change(UserSession, :count)

    expect(ActsAsTenant.current_tenant).to be_nil
    expect([Current.user, Current.request_ip]).to eq([bystander, "10.0.0.9"])
  end

  it "leaves nobody current when nobody was" do
    Current.reset
    run

    expect(Current.user).to be_nil
  end
end
