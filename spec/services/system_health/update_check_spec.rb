require "rails_helper"

RSpec.describe SystemHealth::UpdateCheck do
  let(:url) { "https://api.github.com/repos/GetFixFlow/fixflow/releases/latest" }

  def check(version: "0.1.0", enabled: true, env: {}) = described_class.new(version: version, enabled: enabled, env: env).call

  def release(tag)
    body = { tag_name: tag, html_url: "https://example.test/#{tag}" }.to_json
    stub_request(:get, url).to_return(status: 200, body: body)
  end

  describe "comparing versions" do
    it "knows a newer release from the same one and from an older one" do
      release("v0.2.0")
      expect(check(version: "0.1.0")).to include(status: "warning", latest: "0.2.0")
      expect(check(version: "0.2.0")).to include(status: "ok", latest: "0.2.0")
      expect(check(version: "v0.3.1")).to include(status: "ok")
    end

    it "compares numbers, not text (0.10.0 is newer than 0.9.0)" do
      release("0.10.0")
      expect(check(version: "0.9.0")).to include(status: "warning")
    end

    it "does not guess when a tag is not a version" do
      release("nightly")
      result = check
      expect(result).to include(status: "unknown", latest: nil)
      expect(result[:message]).to include("Could not compare nightly with 0.1.0")
    end
  end

  describe "what it asks, and when" do
    it "is off, and asks nothing, when the company turned it off or the environment did" do
      release("v9.0.0")
      expect(check(enabled: false)).to include(status: "off", enabled: false, locked: false)
      expect(check(env: { "FIXFLOW_UPDATE_CHECK" => "false" })).to include(status: "off", enabled: false, locked: true)
      expect(check(env: { "FIXFLOW_UPDATE_CHECK" => "FALSE" })).to include(locked: true)
      expect(WebMock).not_to have_requested(:get, url)
    end

    it "asks again when the environment says anything other than false" do
      release("v9.0.0")
      expect(check(env: { "FIXFLOW_UPDATE_CHECK" => "true" })).to include(status: "warning")
    end

    it "names the project's own repository and this version, and nothing else" do
      release("v0.1.0")
      check(version: "0.1.0")
      headers = { "User-Agent" => "FixFlow/0.1.0 (update check)", "Accept" => "application/vnd.github+json" }
      expect(WebMock).to have_requested(:get, url).with(headers: headers).once
    end
  end

  describe "when GitHub does not answer well" do
    it "says it does not know, never that you are up to date" do
      stub_request(:get, url).to_timeout
      expect(check).to include(status: "unknown", latest: nil)
      stub_request(:get, url).to_return(status: 403)
      expect(check[:message]).to include("GitHub answered 403")
      stub_request(:get, url).to_return(status: 200, body: "not json")
      expect(check).to include(status: "unknown")
    end

    it "treats 404 as no release yet" do
      stub_request(:get, url).to_return(status: 404)
      expect(check).to include(status: "ok", latest: nil, message: "No release has been published yet.")
    end
  end

  describe "the cache" do
    let(:store) { ActiveSupport::Cache::MemoryStore.new }

    before { allow(Rails).to receive(:cache).and_return(store) }

    it "asks once for twelve hours, then again" do
      release("v0.2.0")
      3.times { check }
      expect(WebMock).to have_requested(:get, url).once
      travel_to(12.hours.from_now + 1.minute) { check }
      expect(WebMock).to have_requested(:get, url).twice
    end

    it "retries a failure after fifteen minutes, not on every visit" do
      stub_request(:get, url).to_timeout
      2.times { check }
      expect(WebMock).to have_requested(:get, url).once
      release("v0.2.0")
      travel_to(16.minutes.from_now) { expect(check).to include(status: "warning") }
    end
  end
end
