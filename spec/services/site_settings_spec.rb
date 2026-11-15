require "rails_helper"

RSpec.describe SiteSettings do
  let(:org) do
    create(:organization).tap do |company|
      company.update!(settings: company.settings.merge("timezone" => "America/New_York", "work_days" => [1, 2, 3, 4, 5],
                                                      "work_hours" => { "start" => "08:00", "end" => "17:00" }, "currency" => "EUR"))
    end
  end
  let(:site) { create(:location, organization: org, location_type: "site", settings: {}) }

  describe ".for" do
    it "is the company's calendar for a site that sets nothing" do
      expect(described_class.for(site)).to eq("timezone" => "America/New_York", "work_days" => [1, 2, 3, 4, 5],
                                              "work_hours" => { "start" => "08:00", "end" => "17:00" }, "holidays" => [])
    end

    it "puts what the site sets over the company's, a key at a time" do
      site.update!(settings: { "timezone" => "Asia/Colombo", "work_hours" => { "start" => "06:00", "end" => "14:00" } })

      expect(described_class.for(site)).to include("timezone" => "Asia/Colombo",
                                                   "work_hours" => { "start" => "06:00", "end" => "14:00" },
                                                   "work_days" => [1, 2, 3, 4, 5])
    end

    it "does not carry anything but a calendar, whatever is kept on the site" do
      site.update!(settings: { "currency" => "GBP", "timezone" => "Asia/Colombo" })

      expect(described_class.for(site).keys).to match_array(%w[timezone work_hours work_days holidays])
    end

    it "is empty with no site" do
      expect(described_class.for(nil)).to eq({})
    end
  end

  describe ".clean" do
    it "keeps only a calendar's keys, in the shapes the company's settings use" do
      cleaned = described_class.clean(timezone: " Asia/Colombo ", work_days: %w[3 1 1],
                                      work_hours: { start: "07:00", end: "15:00", other: "x" },
                                      holidays: [{ date: "2026-12-25", name: "Xmas", repeating: true, junk: 1 }], currency: "GBP")

      expect(cleaned).to eq("timezone" => "Asia/Colombo", "work_days" => [1, 3],
                            "work_hours" => { "start" => "07:00", "end" => "15:00" },
                            "holidays" => [{ "date" => "2026-12-25", "name" => "Xmas", "repeating" => true }])
    end

    it "drops what is blank, so it follows the company, but keeps an empty list of holidays out too" do
      expect(described_class.clean(timezone: "", work_days: [], holidays: [], work_hours: {})).to eq({})
      expect(described_class.clean(nil)).to eq({})
    end
  end

  describe "validation" do
    def errors_of(own) = described_class.new(own).tap(&:validate).errors.attribute_names

    it "accepts a valid calendar, and nothing at all" do
      expect(errors_of({})).to eq([])
      expect(errors_of("timezone" => "Asia/Colombo", "work_days" => [0, 6], "work_hours" => { "start" => "00:00", "end" => "23:59" },
                       "holidays" => [{ "date" => "2026-01-01", "name" => "New year" }])).to eq([])
    end

    it "refuses a time zone, days, hours or a holiday that is not valid" do
      expect(errors_of("timezone" => "Mars/Olympus")).to eq([:timezone])
      expect(errors_of("work_days" => [7])).to eq([:work_days])
      expect(errors_of("work_days" => %w[1])).to eq([:work_days])
      expect(errors_of("work_hours" => { "start" => "17:00", "end" => "08:00" })).to eq([:work_hours])
      expect(errors_of("work_hours" => { "start" => "8", "end" => "17:00" })).to eq([:work_hours])
      expect(errors_of("work_hours" => { "start" => "08:00", "end" => "08:00" })).to eq([:work_hours])
      expect(errors_of("holidays" => [{ "date" => "tomorrow", "name" => "X" }])).to eq([:holidays])
      expect(errors_of("holidays" => [{ "date" => "2026-12-25", "name" => "" }])).to eq([:holidays])
    end
  end
end
