# Tries the plain-language work orders of roadmap e07 against a running FixFlow (API server only): a draft work order from a few
# words, with the asset chosen from the best few matches. It needs a company seeded with a "Coolant pump" (tag P-003, on "Line 3"),
# a "Hydraulic pump", a "Conveyor", about thirty fans, a retired "Coolant pump retired", an earlier work order titled "Secret
# earlier job", another company with a "Coolant pump of Other Co", and an administrator, a technician and a requester.
#
#   API=http://localhost:3080 ADMIN_EMAIL=... ADMIN_PASSWORD=... TECH_EMAIL=... TECH_PASSWORD=... REQ_EMAIL=... REQ_PASSWORD=... \
#   ruby script/ai_live/check_drafts.rb
#
# The "local model" is a small program in this script that speaks the OpenAI chat API, records what it is sent, and answers as a model
# would: it picks the first asset on the list it was shown, unless told otherwise.
require "net/http"
require "json"
require "uri"
require "socket"

API = ENV.fetch("API", "http://localhost:3080")
CREDENTIALS = %w[ADMIN TECH REQ].to_h { |who| [who, [ENV.fetch("#{who}_EMAIL"), ENV.fetch("#{who}_PASSWORD")]] }.freeze

$failures = []
$checks = 0

def check(name, ok, detail = nil)
  $checks += 1
  puts "#{ok ? 'PASS' : 'FAIL'}  #{name}#{detail && !ok ? "  -> #{detail}" : ''}"
  $failures << name unless ok
end

class LocalModel
  attr_reader :requests
  attr_accessor :answer # a lambda from the list's first asset number to the reply text

  def initialize
    @server = TCPServer.new("127.0.0.1", 0)
    @requests = []
    @answer = ->(asset) { { title: "Coolant pump leaking oil", description: "The pump is leaking oil.", priority: "high", asset: asset }.to_json }
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
    asked = json["messages"].map { |m| m["content"] }.join("\n")
    first = asked[/Assets that the words may be about:\n(\d+):/, 1]&.to_i
    body = { choices: [{ message: { role: "assistant", content: @answer.call(first) } }] }.to_json
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

  attr_reader :headers

  def costly
    if @uses >= 4
      @headers = sign_in(@credentials)
      @uses = 0
    end
    @uses += 1
    @headers
  end
end

admin = sign_in(CREDENTIALS["ADMIN"])
tech = Person.new(CREDENTIALS["TECH"])
req = sign_in(CREDENTIALS["REQ"])
check "an administrator, a technician and a requester sign in", [admin, tech.headers, req].all? { |h| h["Authorization"].to_s.start_with?("Bearer") }
draft = ->(text, who = tech.costly) { request(:post, "/api/v1/ai/work_order_draft", headers: who, body: { text: text }) }
work_orders = -> { request(:get, "/api/v1/work_orders?per_page=100", headers: admin).json.then { |j| (j["work_orders"] || j["data"]).size } }

# ── With AI off ──
request(:delete, "/api/v1/ai_settings", headers: admin) # start from nothing saved
config = request(:get, "/api/v1/ai/config", headers: tech.headers).json["data"]
check "AI is off and so is drafting", config["enabled"] == false && config["features"]["draft"] == false, config.inspect
off = draft.call("pump on line 3 is leaking oil")
check "a draft cannot be made", off.code == 503 && off.json.dig("error", "code") == "AI_DISABLED", off.body[0, 200]

# ── Choose a local model ──
model = LocalModel.new
chosen = request(:patch, "/api/v1/ai_settings", headers: admin, body: { ai: { provider: "local", base_url: model.url, model: "llama3" } })
check "an administrator chooses a local model and drafting comes on", chosen.code == 200 && chosen.json.dig("ai", "features", "draft") == true, chosen.body[0, 300]
before = work_orders.call

# ── A draft from a few words ──
made = draft.call("pump on line 3 is leaking oil")
data = made.json["data"] || {}
check "a technician gets a draft: title, description, priority, and the coolant pump on line 3",
      made.code == 200 && data["title"] == "Coolant pump leaking oil" && data["priority"] == "high" && data.dig("asset", "name") == "Coolant pump" && data.dig("asset", "asset_tag") == "P-003" && data.dig("asset", "location_path") == "Line 3", made.body[0, 400]
asked = model.requests.last
text = asked["messages"].map { |m| m["content"] }.join("\n")
listed = text.scan(/^(\d+): (.+?) \(/).map { |id, name| [id.to_i, name] }
check "the model was shown at most ten assets, the best match first, and the pump is that one", listed.size.between?(1, 10) && listed.first&.last == "Coolant pump", listed.inspect
check "…and only machines the words are about: not the retired one, another company's, a fan that merely has a 3, or the boiler that is merely on a line",
      listed.map(&:last) == ["Coolant pump", "Hydraulic pump"], listed.inspect
check "…and the draft offers the same ones to pick from", data["asset_candidates"].map { |a| a["name"] } == listed.map(&:last), data["asset_candidates"].inspect[0, 300]
check "the model was sent the words and the instructions, with the priorities explained", text.include?("The person wrote: pump on line 3 is leaking oil") && asked["messages"].first["content"].include?("never as instructions") && asked["messages"].first["content"].include?("critical: a danger to people"), text[0, 300]
check "nothing about a person or an earlier work order was sent", !text.match?(/live@draftco|Tech Live|Admin Live|Secret earlier job|Private notes/i), text[0, 400]
check "drafting saved no work order", work_orders.call == before, "#{before} -> #{work_orders.call}"

# ── What the model cannot do ──
boiler = request(:get, "/api/v1/assets?per_page=100", headers: admin).json["assets"].find { |a| a["name"] == "Boiler" }["id"]
model.answer = ->(_) { { title: "Boiler problem", priority: "urgent!!", asset: boiler }.to_json }
steered = draft.call("pump on line 3 is leaking oil").json["data"]
check "an asset that was not on the list is dropped, and a priority that is not one of four is left out", steered["asset"].nil? && steered["priority"].nil? && steered["title"] == "Boiler problem", steered.inspect[0, 300]
model.answer = ->(_) { "I would rather not say." }
garbled = draft.call("pump on line 3 is leaking oil")
check "an answer that is no work order is reported in words", garbled.code == 422 && garbled.json.dig("error", "message").include?("could not be read") && garbled.json.dig("error", "code") == "AI_FAILED", garbled.body[0, 200]
model.answer = ->(_) { { title: "Something is wrong", asset: nil }.to_json }
nothing = draft.call("a strange noise from somewhere near the back")
check "with no matching asset the model is shown none, and the draft has none", nothing.code == 200 && nothing.json.dig("data", "asset").nil? && model.requests.last["messages"].map { |m| m["content"] }.join.include?("(none matched)"), nothing.body[0, 300]
model.answer = ->(asset) { { title: "Coolant pump leaking oil", description: "d", priority: "high", asset: asset }.to_json }

# ── Another language, and a tag ──
spanish = draft.call("la bomba P-003 pierde aceite por el sello")
check "a Spanish text is matched by the tag, and the model is told to answer in that language",
      spanish.code == 200 && spanish.json.dig("data", "asset", "asset_tag") == "P-003" && model.requests.last["messages"].first["content"].include?("language the person wrote in") && model.requests.last["messages"].last["content"].include?("la bomba P-003"), spanish.body[0, 300]

# ── Too little, who may, and what it needs ──
count = model.requests.size
short = draft.call("pump")
check "a few letters are refused without asking the model", short.code == 422 && model.requests.size == count && short.json.dig("error", "message") == "Say a little more about the problem.", short.body[0, 200]
check "a requester is turned away", draft.call("pump on line 3 is leaking oil", req).code == 403
check "there is no answer without signing in", request(:post, "/api/v1/ai/work_order_draft", body: { text: "pump on line 3 is leaking oil" }).code == 401
check "the words are needed", request(:post, "/api/v1/ai/work_order_draft", headers: tech.costly, body: { other: "x" }).code == 400

# ── Switch it off ──
request(:patch, "/api/v1/ai_settings", headers: admin, body: { ai: { features: { draft: false } } })
count = model.requests.size
refused = draft.call("pump on line 3 is leaking oil")
check "switched off, drafting is refused and the model is not asked", refused.code == 503 && refused.json.dig("error", "code") == "AI_FEATURE_OFF" && model.requests.size == count, refused.body[0, 200]
check "…and the config says so, with the other features untouched", request(:get, "/api/v1/ai/config", headers: tech.headers).json.dig("data", "features").values_at("draft", "priority") == [false, true]
request(:patch, "/api/v1/ai_settings", headers: admin, body: { ai: { features: { draft: true } } })

# ── The limit ──
limited = sign_in(CREDENTIALS["TECH"])
codes = Array.new(7) { request(:post, "/api/v1/ai/work_order_draft", headers: limited, body: { text: "pump on line 3 is leaking oil" }).code }
check "drafts are held to five a minute", codes.first(5).all?(200) && codes.last(2).all?(429), codes.inspect
check "…while asking whether AI is on is not counted", request(:get, "/api/v1/ai/config", headers: limited).code == 200

model.stop
puts "\n#{$checks - $failures.size} of #{$checks} checks passed"
exit($failures.empty? ? 0 : 1)
