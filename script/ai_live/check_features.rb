# Tries the AI features of roadmap e05 against a running FixFlow the way people use them: a suggested priority, and unusual sensor
# readings flagged from a sensor's own history. It needs the API server AND a Sidekiq worker on the `iot` queue (the flags are
# found in a job), and a company seeded with an asset "Pump 3" that has about five days of "temperature" readings (around 68), a
# "running_hours" counter, a "vibration" sensor with too little history, and an API key with the `iot` scope.
#
#   API=http://localhost:3078 ADMIN_EMAIL=... ADMIN_PASSWORD=... MANAGER_EMAIL=... MANAGER_PASSWORD=... TECH_EMAIL=... \
#   TECH_PASSWORD=... INGEST_KEY=fxk_... ruby script/ai_live/check_features.rb
#
# The "local model" is a small program in this script that speaks the OpenAI chat API and records everything it is sent, so the
# checks can say what did and did not reach a model. Prints one line for each thing it checks.
require "net/http"
require "json"
require "uri"
require "socket"

API = ENV.fetch("API", "http://localhost:3078")
ADMIN = [ENV.fetch("ADMIN_EMAIL"), ENV.fetch("ADMIN_PASSWORD")].freeze
MANAGER = [ENV.fetch("MANAGER_EMAIL"), ENV.fetch("MANAGER_PASSWORD")].freeze
TECH = [ENV.fetch("TECH_EMAIL"), ENV.fetch("TECH_PASSWORD")].freeze
INGEST_KEY = ENV.fetch("INGEST_KEY")

$failures = []
$checks = 0

def check(name, ok, detail = nil)
  $checks += 1
  puts "#{ok ? 'PASS' : 'FAIL'}  #{name}#{detail && !ok ? "  -> #{detail}" : ''}"
  $failures << name unless ok
end

class LocalModel
  attr_reader :requests
  attr_accessor :answer

  def initialize
    @server = TCPServer.new("127.0.0.1", 0)
    @requests = []
    @answer = %({"priority":"critical","reason":"Oil is leaking from a running pump."})
    @thread = Thread.new { loop { Thread.new(@server.accept) { |socket| handle(socket) } } }
  end

  def url = "http://127.0.0.1:#{@server.addr[1]}/v1"
  def stop = (@thread.kill && @server.close)

  private

  def handle(socket)
    socket.gets
    headers = {}
    while (line = socket.gets) && line != "\r\n"
      name, value = line.split(": ", 2)
      headers[name.downcase] = value.to_s.strip
    end
    json = JSON.parse(socket.read(headers["content-length"].to_i).to_s)
    @requests << json
    body = { choices: [{ message: { role: "assistant", content: @answer } }] }.to_json
    socket.write("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: #{body.bytesize}\r\nConnection: close\r\n\r\n#{body}")
  ensure
    socket.close
  end
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

# A person's sign-in for the calls that cost a model call (five a minute each): a new one after every four.
class Person
  def initialize(credentials)
    @credentials = credentials
    @uses = 0
    @headers = sign_in(credentials)
  end

  def headers = @headers

  def costly
    if @uses >= 4
      @headers = sign_in(@credentials)
      @uses = 0
    end
    @uses += 1
    @headers
  end
end

def ingest(asset_id, metric, value, unit: nil)
  request(:post, "/api/v1/iot/ingest", headers: { "X-API-Key" => INGEST_KEY }, body: { asset_id: asset_id, metric: metric, value: value, unit: unit })
end

# The job runs in Sidekiq, so a flag takes a moment to appear: wait for it, up to a few seconds.
def flags(headers, status: "open", wait: 0)
  deadline = Time.now + wait
  loop do
    found = request(:get, "/api/v1/sensor_anomalies?status=#{status}", headers: headers).json["sensor_anomalies"]
    return found if found.any? || Time.now >= deadline

    sleep 0.3
  end
end

admin = Person.new(ADMIN)
technician = Person.new(TECH)
manager = sign_in(MANAGER)
check "an administrator, a manager and a technician sign in", [admin.headers, manager, technician.headers].all? { |h| h["Authorization"].to_s.start_with?("Bearer") }

assets = request(:get, "/api/v1/assets", headers: manager).json["assets"]
pump = assets.find { |a| a["name"] == "Pump 3" }
check "the seeded asset is there", pump, assets.map { |a| a["name"] }.inspect

# ── With AI off ──
config = request(:get, "/api/v1/ai/config", headers: manager).json["data"]
check "AI is off and so is every feature", config["enabled"] == false && config["features"] == { "priority" => false, "anomalies" => false }, config.inspect
off = request(:post, "/api/v1/ai/priority", headers: technician.costly, body: { title: "Pump 3 is leaking oil", asset_id: pump["id"] })
check "a priority cannot be suggested", off.code == 503 && off.json.dig("error", "code") == "AI_DISABLED", off.body[0, 200]
ingest(pump["id"], "temperature", 95.0, unit: "°C")
sleep 2.5
check "an outlier is not flagged while AI is off", flags(manager).empty?

# ── Choose a local model ──
model = LocalModel.new
chosen = request(:patch, "/api/v1/ai_settings", headers: admin.headers, body: { ai: { provider: "local", base_url: model.url, model: "llama3" } })
check "an administrator chooses a local model", chosen.code == 200 && chosen.json.dig("ai", "enabled") == true && chosen.json.dig("ai", "features") == { "priority" => true, "anomalies" => true }, chosen.body[0, 300]
config = request(:get, "/api/v1/ai/config", headers: manager).json["data"]
check "everyone is told both features are on", config["features"] == { "priority" => true, "anomalies" => true }, config.inspect

# ── A suggested priority ──
asked = request(:post, "/api/v1/ai/priority", headers: technician.costly, body: { title: "Pump 3 is leaking oil", description: "Under the left seal", asset_id: pump["id"] })
check "a technician is given a priority and a reason", asked.code == 200 && asked.json["data"] == { "priority" => "critical", "reason" => "Oil is leaking from a running pump." }, asked.body[0, 300]
sent = model.requests.last
text = sent && sent["messages"].map { |m| m["content"] }.join("\n")
check "the model was sent the title, the description, the asset and what is open on it",
      text.to_s.include?("Pump 3 is leaking oil") && text.include?("Under the left seal") && text.include?("Pump 3 (P-003)") && text.include?("1 high") && text.include?("by severity: none"), text.to_s[0, 500]
check "…held to a priority, with the instructions as the system message", sent && sent["messages"].first["role"] == "system" && sent["messages"].first["content"].include?("critical"), sent.inspect[0, 300]
check "…and nothing about a person", !text.to_s.match?(/@smartco|Live|password/i), text.to_s[0, 300]
model.answer = "Probably high, it should be fixed this week."
words = request(:post, "/api/v1/ai/priority", headers: technician.costly, body: { title: "Belt is squealing" })
check "a model that answers in words is understood when it names one priority", words.code == 200 && words.json.dig("data", "priority") == "high", words.body[0, 200]
model.answer = "I would rather not say."
garbled = request(:post, "/api/v1/ai/priority", headers: technician.costly, body: { title: "Belt is squealing" })
check "an answer that is no priority is reported in words, not guessed", garbled.code == 422 && garbled.json.dig("error", "message").include?("could not be read"), garbled.body[0, 200]
none = request(:post, "/api/v1/ai/priority", headers: technician.costly, body: { description: "no title" })
check "a title is needed", none.code == 400, none.body[0, 200]
requester_asks = request(:post, "/api/v1/ai/priority", headers: manager, body: { title: "Belt is squealing", asset_id: 0 })
check "an asset that is not there is not found", requester_asks.code == 404, requester_asks.body[0, 200]
model.answer = %({"priority":"critical","reason":"x"})

# ── Unusual readings ──
before = model.requests.size
check "nothing is flagged yet (the earlier outlier came while AI was off)", flags(manager).empty?
normal = ingest(pump["id"], "temperature", 69.0, unit: "°C")
sleep 2
check "an ordinary reading is not flagged", normal.code == 200 && flags(manager).empty?
ingest(pump["id"], "temperature", 91.2, unit: "°C")
found = flags(manager, wait: 12)
flag = found.first
check "an outlier is flagged, with the range that is usual for that sensor",
      found.size == 1 && flag["metric_name"] == "temperature" && flag["value"] == 91.2 && flag["usual_middle"].between?(66, 70) && flag["usual_low"] < flag["usual_middle"] && flag["usual_high"] > flag["usual_middle"] && flag["baseline_count"] >= 300 && flag["score"] > 6,
      found.inspect[0, 400]
check "…with the asset and a line to read", flag && flag["asset"]["name"] == "Pump 3" && flag["message"].start_with?("temperature reads 91.2 °C; it is usually"), flag.inspect[0, 300]
ingest(pump["id"], "temperature", 95.0, unit: "°C")
sleep 2.5
check "a second outlier from the same sensor is not a second flag (one fault is one line)", flags(manager).size == 1
ingest(pump["id"], "running_hours", 99_999, unit: "h")
ingest(pump["id"], "vibration", 80.0, unit: "mm/s")
sleep 3
metrics = flags(manager).map { |f| f["metric_name"] }
check "a counter that only goes up, and a sensor with too little history, are left alone", metrics == ["temperature"], metrics.inspect
check "working it out sent nothing to the model", model.requests.size == before, "#{model.requests.size - before} requests"

# ── Answering a flag ──
check "a technician can see the flags but not answer them",
      request(:get, "/api/v1/sensor_anomalies", headers: technician.headers).code == 200 && request(:patch, "/api/v1/sensor_anomalies/#{flag['id']}/dismiss", headers: technician.headers).code == 403
acknowledged = request(:patch, "/api/v1/sensor_anomalies/#{flag['id']}/acknowledge", headers: manager, body: { notes: "Checking the bearing" })
check "a manager says it is real", acknowledged.code == 200 && acknowledged.json.dig("data", "status") == "acknowledged" && acknowledged.json.dig("data", "notes") == "Checking the bearing", acknowledged.body[0, 200]
check "…it is no longer open but is still listed as acknowledged", flags(manager).empty? && flags(manager, status: "acknowledged").size == 1
dismissed = request(:patch, "/api/v1/sensor_anomalies/#{flag['id']}/dismiss", headers: manager)
again = request(:patch, "/api/v1/sensor_anomalies/#{flag['id']}/dismiss", headers: manager)
check "it can be dismissed once, and then says in words that it is over", dismissed.code == 200 && again.code == 422 && again.json.dig("error", "message") == "This flag is already dismissed", again.body[0, 200]

# ── Switching them off ──
only = request(:patch, "/api/v1/ai_settings", headers: admin.headers, body: { ai: { features: { anomalies: false } } })
check "an administrator switches unusual readings off on its own, and the provider stays",
      only.code == 200 && only.json.dig("ai", "provider") == "local" && only.json.dig("ai", "enabled") == true && only.json.dig("ai", "features") == { "priority" => true, "anomalies" => false }, only.body[0, 300]
config = request(:get, "/api/v1/ai/config", headers: manager).json["data"]
check "everyone is told", config["features"] == { "priority" => true, "anomalies" => false }, config.inspect
ingest(pump["id"], "pressure", 40.0, unit: "bar")
sleep 3
check "an outlier is no longer flagged", flags(manager).none? { |f| f["metric_name"] == "pressure" }
request(:patch, "/api/v1/ai_settings", headers: admin.headers, body: { ai: { features: { anomalies: true, priority: false } } })
before = model.requests.size
off = request(:post, "/api/v1/ai/priority", headers: technician.costly, body: { title: "Pump 3 is leaking oil" })
check "with the priority switched off the call is refused and the model is not asked", off.code == 503 && off.json.dig("error", "code") == "AI_FEATURE_OFF" && model.requests.size == before, off.body[0, 200]
ingest(pump["id"], "pressure", 41.0, unit: "bar")
check "switched back on, an outlier is flagged again", flags(manager, wait: 12).any? { |f| f["metric_name"] == "pressure" }
removed = request(:patch, "/api/v1/ai_settings", headers: admin.headers, body: { ai: { provider: "none" } })
check "switching AI off turns every feature off", removed.code == 200 && request(:get, "/api/v1/ai/config", headers: manager).json.dig("data", "features") == { "priority" => false, "anomalies" => false }

# ── The rate limit ──
request(:patch, "/api/v1/ai_settings", headers: admin.headers, body: { ai: { provider: "local", base_url: model.url, model: "llama3", features: { priority: true } } })
limited = sign_in(TECH)
codes = Array.new(7) { request(:post, "/api/v1/ai/priority", headers: limited, body: { title: "Pump 3 is leaking oil" }).code }
check "suggested priorities are held to five a minute", codes.first(5).all?(200) && codes.last(2).all?(429), codes.inspect
check "…while asking whether AI is on is not counted", request(:get, "/api/v1/ai/config", headers: limited).code == 200

model.stop
puts "\n#{$checks - $failures.size} of #{$checks} checks passed"
exit($failures.empty? ? 0 : 1)
