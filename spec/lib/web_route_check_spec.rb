require "rails_helper"
require Rails.root.join("lib/web_route_check")

RSpec.describe WebRouteCheck do
  def call(verb, path, **extra) = { verb: verb, path: path, file: "src/api/x.ts", line: 1, dynamic: false }.merge(extra)

  def check(calls, routes, allowed: []) = described_class.new(calls: calls, routes: routes, allowed: allowed).run

  describe ".fits?" do
    it "fits the same words, and a variable with a variable" do
      expect(described_class.fits?(%w[assets :param], %w[assets :id])).to be(true)
      expect(described_class.fits?(%w[assets], %w[assets])).to be(true)
    end

    it "lets a word in the call fill a variable in the route (/imports/assets/template for /imports/:kind/template)" do
      expect(described_class.fits?(%w[imports assets template], %w[imports :kind template])).to be(true)
    end

    it "never lets a variable in the call fill a fixed word (the call could ask for anything, the route only answers one)" do
      expect(described_class.fits?(%w[assets :param], %w[assets new])).to be(false)
    end

    it "does not fit a different word or a different length" do
      expect(described_class.fits?(%w[assets], %w[parts])).to be(false)
      expect(described_class.fits?(%w[assets :param edit], %w[assets :id])).to be(false)
      expect(described_class.fits?(%w[assets], %w[assets :id])).to be(false)
    end
  end

  describe "#run" do
    let(:routes) do
      [["GET", "/api/v1/assets(.:format)"], ["POST", "/api/v1/assets(.:format)"], ["GET", "/api/v1/assets/:id(.:format)"],
       ["PATCH", "/api/v1/assets/:id(.:format)"], ["GET", "/up"], ["GET", "/cable"]]
    end

    it "finds a route for each request that has one" do
      result = check([call("get", "/assets"), call("post", "/assets"), call("patch", "/assets/:param")], routes)

      expect(result.matched.size).to eq(3)
      expect(result).to be_ok
    end

    it "reports a request with no route, with where it is" do
      result = check([call("delete", "/assets/:param", file: "src/api/assets.ts", line: 40)], routes)

      expect(result.missing.map { |c|
        [c[:verb], c[:path], c[:file], c[:line]]
      }).to eq([["delete", "/assets/:param", "src/api/assets.ts", 40]])
      expect(result).not_to be_ok
    end

    it "does not take a route for another verb as an answer" do
      expect(check([call("put", "/assets/:param")], routes).missing.size).to eq(1)
    end

    it "does not count a route outside the API (the health check, the cable) as an answer" do
      expect(check([call("get", "/up"), call("get", "/cable")], routes).missing.size).to eq(2)
    end

    it "lets a route that answers several verbs at once (\"PUT|PATCH\") answer each" do
      multi = [["PUT|PATCH", "/api/v1/auth/password(.:format)"]]

      expect(check([call("put", "/auth/password"), call("patch", "/auth/password")], multi)).to be_ok
      expect(check([call("post", "/auth/password")], multi)).not_to be_ok
    end

    it "reads a .csv or .pdf address as the route without the suffix" do
      expect(check([call("get", "/assets.csv"), call("get", "/assets/:param.pdf")], routes)).to be_ok
    end

    it "does not hide a request whose address is not written out in the source" do
      result = check([call("get", nil, dynamic: true)], routes)

      expect(result.dynamic.size).to eq(1)
      expect(result).not_to be_ok
    end

    it "lets a request without a route through only when it is allowed, with a reason" do
      allowed = [{ "call" => "DELETE /assets/:param", "reason" => "retired on purpose" }]
      result = check([call("delete", "/assets/:param")], routes, allowed: allowed)

      expect(result.allowed.size).to eq(1)
      expect(result.missing).to be_empty
      expect(result).to be_ok
    end

    it "reports an allowance that no request uses any more, so the list does not rot" do
      allowed = [{ "call" => "DELETE /gone", "reason" => "was needed once" }]
      result = check([call("get", "/assets")], routes, allowed: allowed)

      expect(result.stale_allowances).to eq(["DELETE /gone"])
      expect(result).not_to be_ok
    end

    it "does not let an allowance hide a request that now has a route" do
      allowed = [{ "call" => "GET /assets", "reason" => "was missing once" }]

      expect(check([call("get", "/assets")], routes, allowed: allowed).stale_allowances).to eq(["GET /assets"])
    end
  end

  describe ".routes_without_action" do
    def route(path, controller, action, verb = "GET")
      Struct.new(:path, :defaults, :verb).new(Struct.new(:spec).new(path), { controller: controller, action: action }, verb)
    end

    it "finds an API route whose controller or action does not exist" do
      routes = [route("/api/v1/health(.:format)", "api/v1/health", "show"),
                route("/api/v1/ghosts(.:format)", "api/v1/ghosts", "index"),
                route("/api/v1/health/missing(.:format)", "api/v1/health", "missing")]

      expect(described_class.routes_without_action(routes)).to eq(["GET /api/v1/ghosts -> api/v1/ghosts#index",
                                                                   "GET /api/v1/health/missing -> api/v1/health#missing"])
    end

    it "ignores routes outside the API and ones that lead to an engine or a redirect (no controller)" do
      routes = [route("/up", "rails/health", "show"),
                Struct.new(:path, :defaults, :verb).new(Struct.new(:spec).new("/api/v1/x"), {}, "GET")]

      expect(described_class.routes_without_action(routes)).to eq([])
    end
  end

  describe "the real app" do
    it "has no API route that leads nowhere" do
      expect(described_class.routes_without_action(Rails.application.routes.routes)).to eq([])
    end

    it "makes only requests that have a route (the same check as bin/rails web:check_routes)" do
      skip "Node is not installed" unless system("node", "--version", out: File::NULL, err: File::NULL)

      output = IO.popen(["node", Rails.root.join("apps/web/scripts/list-api-calls.mjs").to_s], &:read)
      calls = JSON.parse(output, symbolize_names: true)
      routes = Rails.application.routes.routes.filter_map { |r| [r.verb, r.path.spec.to_s] if r.verb.present? }
      allowed = YAML.load_file(Rails.root.join("config/web_routes_allowlist.yml"))

      result = described_class.new(calls: calls, routes: routes, allowed: allowed).run

      expect(calls.size).to be > 100
      expect(result.missing.map { |c| "#{c[:verb].upcase} #{c[:path]} (#{c[:file]}:#{c[:line]})" }).to eq([])
      expect(result.dynamic).to eq([])
      expect(result.stale_allowances).to eq([])
    end
  end
end
