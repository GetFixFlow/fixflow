require "rails_helper"
require "yaml"

# The promises of docs/support.md (roadmap e12) that a change elsewhere could quietly break: the monthly release day, the places
# people are sent to, and that the page offers help for money, not features.
RSpec.describe "Support and community" do # rubocop:disable RSpec/DescribeClass
  def read(path) = Rails.root.join(path).read

  let(:support) { read("docs/support.md") }
  let(:workflow) { YAML.safe_load(read(".github/workflows/release-reminder.yml"), permitted_classes: [Symbol]) }
  let(:schedule) { workflow.fetch(true, workflow["on"]).fetch("schedule") } # YAML reads an unquoted `on:` key as true

  it "promises a release on the first Tuesday of the month, and says so everywhere it says anything about releases" do
    %w[docs/support.md CONTRIBUTING.md README.md].each do |file|
      expect(read(file)).to include("first Tuesday of every month"), "#{file} no longer says when releases come out"
    end
  end

  describe "the reminder workflow" do
    let(:script) { workflow.dig("jobs", "remind", "steps", 0, "run") }

    it "runs on Tuesdays, and does nothing unless the day of the month is 1 to 7 (the first Tuesday)" do
      expect(schedule.first.fetch("cron").split[4]).to eq("2")
      expect(script).to include('date -u +%-d)" -le 7')
    end

    it "can be run by hand, to try it" do
      expect(workflow.fetch(true, workflow["on"])).to have_key("workflow_dispatch")
    end

    it "may only open issues" do
      expect(workflow.fetch("permissions")).to eq("issues" => "write")
    end

    it "does not open a second issue for the same month" do
      expect(script).to include("Already open")
    end
  end

  it "sends people to Discussions for questions and to this page for paid help, from the issue chooser" do
    chooser = YAML.safe_load(read(".github/ISSUE_TEMPLATE/config.yml"))
    urls = chooser.fetch("contact_links").pluck("url")

    expect(urls).to include("https://github.com/GetFixFlow/fixflow/discussions", "https://getfixflow.github.io/fixflow/latest/support/")
    expect(chooser.fetch("blank_issues_enabled")).to be(false)
  end

  it "is in the docs menu and on the docs home page" do
    expect(read("mkdocs.yml")).to include("support.md")
    expect(read("docs/index.md")).to include("(support.md)")
  end

  it "describes the four ways to pay for people's time, and keeps the promise that no feature is held back" do
    ["Support contract", "Setup help", "Sponsored features", "Managed hosting"].each do |offer|
      expect(support).to match(/^### #{offer}$/)
    end
    expect(support).to include("nothing described on this page is a feature held back")
    expect(support).to include("**everyone gets it**")
  end

  it "does not name a price or an answer time it has not agreed with anyone" do
    expect(support).not_to match(/[$€£]\s?\d|\d\s?(USD|EUR|GBP)|\bper (month|year|hour|user)\b/i)
    expect(support).to include("There is no promised answer time")
  end
end
