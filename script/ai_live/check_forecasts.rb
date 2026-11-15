# Tries the forecasts of roadmap e06 against a running FixFlow (API server only; they are worked out on the spot, so no worker is
# needed): which sensors are heading for a limit set on an alert rule, and which parts may run short. It needs a company seeded
# with a "Pump 3" whose temperature has climbed about 0.5 a day for 30 days towards a rule at 85, a steady "Fan 1" with the same
# rule, a part "Belt" used 4 a month for six months with 3 in stock, a lightly used "Filter" with plenty in stock, a "Rare seal"
# used only twice, and a requester, a technician, a manager and an administrator.
#
#   API=http://localhost:3079 ADMIN_EMAIL=... ADMIN_PASSWORD=... MANAGER_EMAIL=... MANAGER_PASSWORD=... TECH_EMAIL=... \
#   TECH_PASSWORD=... REQ_EMAIL=... REQ_PASSWORD=... ruby script/ai_live/check_forecasts.rb
#
# A small program stands in for a local model and counts what it is sent: the forecasts must never ask it anything.
require "net/http"
require "json"
require "uri"
require "socket"

API = ENV.fetch("API", "http://localhost:3079")
CREDENTIALS = %w[ADMIN MANAGER TECH REQ].to_h { |who| [who, [ENV.fetch("#{who}_EMAIL"), ENV.fetch("#{who}_PASSWORD")]] }.freeze

$failures = []
$checks = 0

def check(name, ok, detail = nil)
  $checks += 1
  puts "#{ok ? 'PASS' : 'FAIL'}  #{name}#{detail && !ok ? "  -> #{detail}" : ''}"
  $failures << name unless ok
end

class LocalModel
  attr_reader :requests

  def initialize
    @server = TCPServer.new("127.0.0.1", 0)
    @requests = 0
    @thread = Thread.new { loop { Thread.new(@server.accept) { |socket| @requests += 1; socket.close } } }
  end

  def url = "http://127.0.0.1:#{@server.addr[1]}/v1"
  def stop = (@thread.kill && @server.close)
end

Response = Struct.new(:code, :headers, :body) do
  def json = JSON.parse(body)
end

def request(verb, path, body: nil, headers: {})
  uri = URI("#{API}#{path}")
  req = Net::HTTP.const_get(verb.to_s.capitalize).new(uri)
  headers.each { |k, v| req[k] = v }
  if body
    req["Content-Type"] = "application/json"
    req.body = JSON.generate(body)
  end
  res = Net::HTTP.start(uri.host, uri.port, read_timeout: 60) { |http| http.request(req) }
  Response.new(res.code.to_i, res.each_header.to_h, res.body.to_s)
end

def sign_in(credentials)
  response = request(:post, "/api/v1/auth/sign_in", body: { user: { email: credentials[0], password: credentials[1] } })
  raise "sign-in failed for #{credentials[0]}: #{response.code} #{response.body[0, 200]}" unless response.code == 200

  { "Authorization" => response.headers["authorization"] }
end

who = CREDENTIALS.transform_values { |credentials| sign_in(credentials) }
check "four people sign in", who.values.all? { |h| h["Authorization"].to_s.start_with?("Bearer") }
limits = ->(headers = who["TECH"], query = "") { request(:get, "/api/v1/ai/forecasts/limits#{query}", headers: headers) }
parts = ->(headers = who["TECH"], query = "") { request(:get, "/api/v1/ai/forecasts/parts#{query}", headers: headers) }

# ── With AI off ──
config = request(:get, "/api/v1/ai/config", headers: who["MANAGER"]).json["data"]
check "AI is off and so is every feature", config["enabled"] == false && config["features"].values.none?, config.inspect
off = [limits.call, parts.call]
check "neither forecast is available", off.all? { |r| r.code == 503 && r.json.dig("error", "code") == "AI_DISABLED" }, off.map(&:body).inspect[0, 200]

# ── Choose a local model ──
model = LocalModel.new
chosen = request(:patch, "/api/v1/ai_settings", headers: who["ADMIN"], body: { ai: { provider: "local", base_url: model.url, model: "llama3" } })
check "an administrator chooses a local model and all four features come on",
      chosen.code == 200 && chosen.json.dig("ai", "features") == { "priority" => true, "anomalies" => true, "limits" => true, "parts" => true }, chosen.body[0, 300]

# ── Sensors heading for a limit ──
found = limits.call
forecasts = found.json["data"]
check "a technician is told Pump 3 is heading for its limit, and the steady fan is not", found.code == 200 && forecasts.map { |f| f["asset"]["name"] } == ["Pump 3"], found.body[0, 400]
pump = forecasts.first || {}
check "…with the limit, where it is now, and how fast it is climbing",
      pump["limit"] == 85.0 && pump["current"].to_f.between?(74, 77) && pump["slope_per_day"].to_f.between?(0.4, 0.6) && pump["metric_name"] == "temperature" && pump["unit"] == "°C", pump.inspect[0, 400]
check "…when it gets there is about 20 days off, with a range around it",
      pump["days_left"].to_f.between?(15, 25) && pump["days_soonest"].to_f <= pump["days_left"].to_f && pump["days_latest"].to_f >= pump["days_left"].to_f, pump.inspect[0, 300]
check "…with the date, and what it rests on",
      pump["reaches_on"].to_s.match?(/\A\d{4}-\d\d-\d\d\z/) && pump["r2"].to_f > 0.9 && pump["days_of_history"].to_i >= 28 && pump["points"].to_i >= 28, pump.inspect[0, 300]
check "it can be narrowed to an asset", limits.call(who["TECH"], "?asset_id=0").json["data"] == []
rule_id = pump.dig("rule", "id")
paused = request(:patch, "/api/v1/iot_rules/#{rule_id}/pause", headers: who["MANAGER"])
check "a rule that is paused is no longer looked at", paused.code == 200 && limits.call.json["data"].empty?, paused.body[0, 200]
request(:patch, "/api/v1/iot_rules/#{rule_id}/resume", headers: who["MANAGER"])
check "…and is again when it is switched back on", limits.call.json["data"].size == 1

# ── Parts that may run short ──
found = parts.call
rows = found.json["data"]
check "the parts page is told Belt may run short, and nothing else by default", found.code == 200 && rows.map { |r| r["part"]["name"] } == ["Belt"], found.body[0, 400]
belt = rows.first || {}
check "…with what is expected, the range, what is held, and how many to order",
      belt["status"] == "short" && belt["expected"].to_f.between?(3, 5) && belt["low"].to_f < belt["expected"].to_f && belt["high"].to_f > belt["expected"].to_f &&
      belt["on_hand"] == 3.0 && belt["on_order"] == 0.0 && belt["suggested_quantity"].to_i.positive?, belt.inspect[0, 400]
check "…and what it rests on", belt["periods"] == 6 && belt["uses"] == 12, belt.inspect[0, 300]
everything = parts.call(who["TECH"], "?all=true").json["data"].map { |r| [r["part"]["name"], r["status"]] }
check "asking for all lists the part with plenty too, and still not the one used only twice", everything == [["Belt", "short"], ["Filter", "ok"]], everything.inspect

# ── Who may ask ──
check "a requester is turned away from both", [limits.call(who["REQ"]), parts.call(who["REQ"])].all? { |r| r.code == 403 }
check "there is no answer without signing in", request(:get, "/api/v1/ai/forecasts/parts").code == 401

# ── Switches ──
request(:patch, "/api/v1/ai_settings", headers: who["ADMIN"], body: { ai: { features: { limits: false } } })
a = limits.call
b = parts.call
check "with sensor forecasts switched off, only they are refused", a.code == 503 && a.json.dig("error", "code") == "AI_FEATURE_OFF" && b.code == 200, "#{a.code} #{b.code}"
request(:patch, "/api/v1/ai_settings", headers: who["ADMIN"], body: { ai: { features: { limits: true, parts: false } } })
check "with parts forecasts switched off, only they are refused", limits.call.code == 200 && parts.call.code == 503
request(:patch, "/api/v1/ai_settings", headers: who["ADMIN"], body: { ai: { features: { parts: true } } })

# ── Cost ──
codes = Array.new(12) { [limits.call.code, parts.call.code] }.flatten
check "asking again and again is not limited (nothing here costs a model call)", codes.all?(200), codes.uniq.inspect
check "none of it asked the model anything", model.requests.zero?, "#{model.requests} requests"

model.stop
puts "\n#{$checks - $failures.size} of #{$checks} checks passed"
exit($failures.empty? ? 0 : 1)
