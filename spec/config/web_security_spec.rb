require "rails_helper"

# What the web app's own server (nginx) sends and logs, from the security review before 1.0. Nothing in the suite starts nginx,
# so these read its configuration the way production_stack_spec.rb does.
RSpec.describe "The web app's security settings" do # rubocop:disable RSpec/DescribeClass
  let(:nginx)   { Rails.root.join("apps/web/nginx.conf").read }
  let(:headers) { Rails.root.join("apps/web/nginx-security-headers.conf").read }
  let(:csp)     { headers[/Content-Security-Policy"?\s+"([^"]+)"/, 1] || raise("no Content-Security-Policy in the headers file") }

  def directive(name) = csp[/(?:\A|;\s*)#{Regexp.escape(name)}\s+([^;]+)/, 1].to_s.split

  describe "the Content-Security-Policy" do
    it "lets the page load script only from itself: no inline script and no eval, so an injected script has nothing to run with" do
      expect(directive("script-src")).to eq(["'self'"])
      expect(csp).not_to include("unsafe-eval")
    end

    it "lets the page talk only to its own server, so nothing it reads can be sent elsewhere" do
      expect(directive("connect-src")).to eq(["'self'"])
      expect(directive("default-src")).to eq(["'self'"])
    end

    it "allows no plugins, no framing, no other base address and no other form target" do
      expect(directive("object-src")).to eq(["'none'"])
      expect(directive("frame-ancestors")).to eq(["'none'"])
      expect(directive("base-uri")).to eq(["'self'"])
      expect(directive("form-action")).to eq(["'self'"])
    end

    it "still lets the app show photos being chosen and the QR codes it draws (data: and blob: images)" do
      expect(directive("img-src")).to include("'self'", "data:", "blob:")
    end

    it "is sent with the files of the app and its own page, where nginx would otherwise drop the headers" do
      expect(nginx.scan("include /etc/nginx/fixflow-security-headers.conf;").size).to be >= 2
    end
  end

  describe "the access log" do
    let(:redaction) do
      # map $request_uri $logged_uri { "~^(?<before>...)..." "${before}REDACTED${after}"; }
      pattern = nginx[/map \$request_uri \$logged_uri \{.*?"~([^"]+)"/m, 1] || raise("no \\$logged_uri map in nginx.conf")
      Regexp.new(pattern.gsub("(?<", "(?<"))
    end

    def logged(uri)
      match = redaction.match(uri)
      match ? "#{match[:before]}REDACTED#{match[:after]}" : uri
    end

    it "logs the address without the sign-in token the live-updates connection carries" do
      expect(nginx).to include('"uri":"$logged_uri"')
      expect(nginx).not_to include('"uri":"$request_uri"')
      expect(logged("/cable?token=eyJhbGciOiJIUzI1NiJ9.abc.def")).to eq("/cable?token=REDACTED")
      expect(logged("/cable?x=1&token=secret&y=2")).to eq("/cable?x=1&token=REDACTED&y=2")
    end

    it "leaves other addresses as they are" do
      expect(logged("/api/v1/work_orders?status=open")).to eq("/api/v1/work_orders?status=open")
    end
  end

  it "keeps codes, challenges and recovery codes out of the application log" do
    filter = ActiveSupport::ParameterFilter.new(Rails.application.config.filter_parameters)
    filtered = filter.filter("code" => "123456", "challenge" => "abc", "recovery_code" => "x", "title" => "Pump")

    expect(filtered).to eq("code" => "[FILTERED]", "challenge" => "[FILTERED]", "recovery_code" => "[FILTERED]", "title" => "Pump")
  end
end
