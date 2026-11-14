# Tries the AI provider choice against a running FixFlow (API server only; no Sidekiq is needed) the way an administrator does:
# AI is off, an address that would send data off the network is refused, a model on this machine is set up and tried, the
# assistant answers from it on a work order, a key is kept and dropped as it should be, and what the model does wrong is
# reported in words. The "local model" is a small program in this script that speaks the OpenAI chat API (streaming included)
# and records what it is sent. Prints one line for each thing it checks.
#
#   API=http://localhost:3077 ADMIN_EMAIL=... ADMIN_PASSWORD=... MANAGER_EMAIL=... MANAGER_PASSWORD=... \
#   TECH_EMAIL=... TECH_PASSWORD=... ruby script/ai_live/check.rb
#
# Start the server with AI_ENABLED unset (or false), so it begins off. The local model listens on this computer's loopback,
# which is exactly what the "local model" choice allows. Two limits are in the way and are worked around here: sign-in is 10 a
# minute per address, and the assistant and the Try it button are 5 a minute per sign-in, so this signs in again when a
# sign-in has had its five, and a last check shows the limit itself.
require "net/http"
require "json"
require "uri"
require "socket"
require "time"

API = ENV.fetch("API", "http://localhost:3077")
ADMIN = [ENV.fetch("ADMIN_EMAIL"), ENV.fetch("ADMIN_PASSWORD")].freeze
MANAGER = [ENV.fetch("MANAGER_EMAIL"), ENV.fetch("MANAGER_PASSWORD")].freeze
TECH = [ENV.fetch("TECH_EMAIL"), ENV.fetch("TECH_PASSWORD")].freeze

$failures = []
$checks = 0

def check(name, ok, detail = nil)
  $checks += 1
  puts "#{ok ? 'PASS' : 'FAIL'}  #{name}#{detail && !ok ? "  -> #{detail}" : ''}"
  $failures << name unless ok
end

# ── A program standing in for Ollama: it speaks the OpenAI chat API, records what it is sent and answers as told ──
class LocalModel
  attr_reader :requests
  attr_accessor :answers # statuses to answer with, in turn; a good answer when empty

  def initialize
    @server = TCPServer.new("127.0.0.1", 0)
    @requests = []
    @answers = []
    @thread = Thread.new { serve }
  end

  def port = @server.addr[1]
  def url = "http://127.0.0.1:#{port}/v1"
  def stop = (@thread.kill && @server.close)

  private

  def serve
    loop { Thread.new(@server.accept) { |socket| handle(socket) } }
  end

  def handle(socket)
    request_line = socket.gets.to_s
    headers = {}
    while (line = socket.gets) && line != "\r\n"
      name, value = line.split(": ", 2)
      headers[name.downcase] = value.to_s.strip
    end
    body = socket.read(headers["content-length"].to_i).to_s
    json = JSON.parse(body) rescue {}
    @requests << { line: request_line.strip, headers: headers, json: json }
    status = @answers.shift || 200
    return refuse(socket, status) unless status == 200

    json["stream"] ? stream(socket) : answer(socket, "ready")
  ensure
    socket.close
  end

  def refuse(socket, status)
    message = status == 401 ? "Incorrect API key provided: #{@requests.last[:headers]['authorization'].to_s.delete_prefix('Bearer ')}" : "model 'nope' not found"
    body = { error: { message: message } }.to_json
    socket.write("HTTP/1.1 #{status} X\r\nContent-Type: application/json\r\nContent-Length: #{body.bytesize}\r\nConnection: close\r\n\r\n#{body}")
  end

  def answer(socket, text)
    body = { choices: [{ message: { role: "assistant", content: text } }] }.to_json
    socket.write("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: #{body.bytesize}\r\nConnection: close\r\n\r\n#{body}")
  end

  def stream(socket)
    socket.write("HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nTransfer-Encoding: chunked\r\nConnection: close\r\n\r\n")
    pieces = ["data: #{{ choices: [{ delta: { role: 'assistant' } }] }.to_json}\n\n"]
    ["Check ", "the ", "seal, ünd ", "世界."].each { |text| pieces << "data: #{{ choices: [{ delta: { content: text } }] }.to_json}\n\n" }
    pieces << "data: [DONE]\n\n"
    pieces.each do |piece|
      socket.write("#{piece.bytesize.to_s(16)}\r\n#{piece}\r\n")
      sleep 0.05
    end
    socket.write("0\r\n\r\n")
  end
end

class Client
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
    res = Net::HTTP.start(uri.host, uri.port, read_timeout: 90) { |http| http.request(req) }
    Response.new(res.code.to_i, res.each_header.to_h, res.body.to_s)
  end
end

http = Client.new

def sign_in(http, credentials)
  response = http.request(:post, "/api/v1/auth/sign_in", body: { user: { email: credentials[0], password: credentials[1] } })
  raise "sign-in failed for #{credentials[0]}: #{response.code} #{response.body[0, 200]}" unless response.code == 200

  { "Authorization" => response.headers["authorization"] }
end

# A person's sign-in, used for the model calls (five a minute each): a new one is taken after every four.
class Person
  attr_reader :headers

  def initialize(http, credentials)
    @http = http
    @credentials = credentials
    @uses = 0
    @headers = sign_in(http, credentials)
  end

  def costly
    if @uses >= 4
      @headers = sign_in(@http, @credentials)
      @uses = 0
    end
    @uses += 1
    @headers
  end
end

admin = Person.new(http, ADMIN)
technician = Person.new(http, TECH)
manager = sign_in(http, MANAGER)
tech = technician.headers
check "an administrator, a manager and a technician sign in", [admin.headers, manager, tech].all? { |h| h["Authorization"].to_s.start_with?("Bearer") }

# ── Off by default ──
first = http.request(:get, "/api/v1/ai_settings", headers: admin.headers)
settings = first.json["ai"]
check "AI starts off: no provider, nothing saved, no environment",
      first.code == 200 && settings["provider"] == "none" && settings["enabled"] == false && settings["source"].nil? && settings["environment_configured"] == false, first.body[0, 300]
check "…and the settings list the three providers, with Claude's default model",
      settings["providers"].keys == %w[anthropic openai_compatible local] && settings["providers"]["anthropic"]["default_model"] == "claude-sonnet-5-5", settings.inspect
config = http.request(:get, "/api/v1/ai/config", headers: manager).json["data"]
check "everyone else is told it is off", config["enabled"] == false && config["provider"] == "none", config.inspect
asked = http.request(:get, "/api/v1/assets", headers: manager).json["assets"].first
made = http.request(:post, "/api/v1/work_orders", headers: manager, body: { work_order: { title: "AI check: pump seal is weeping", asset_id: asked["id"], priority: "high", description: "Oil on the floor under the pump" } })
work_order_id = made.json.dig("data", "id")
check "a work order is made to ask about", made.code == 201 && work_order_id, made.body[0, 200]
refused_off = http.request(:post, "/api/v1/ai/assist", headers: technician.costly, body: { work_order_id: work_order_id, message: "What now?" })
check "the assistant refuses while AI is off", refused_off.code == 503 && refused_off.json.dig("error", "code") == "AI_DISABLED", refused_off.body[0, 200]
check "only an administrator reads or changes the AI settings",
      [manager, tech].all? { |who| http.request(:get, "/api/v1/ai_settings", headers: who).code == 403 && http.request(:patch, "/api/v1/ai_settings", headers: who, body: { ai: { provider: "none" } }).code == 403 && http.request(:post, "/api/v1/ai_settings/test", headers: (who == tech ? technician.costly : who), body: { ai: { provider: "local" } }).code == 403 }

# ── What may not be chosen ──
public = http.request(:patch, "/api/v1/ai_settings", headers: admin.headers, body: { ai: { provider: "local", base_url: "http://203.0.113.10:11434/v1", model: "llama3" } })
check "a local model on the internet is refused: the data would leave", public.code == 422 && public.json.dig("error", "message").include?("would leave it"), public.body[0, 250]
metadata = http.request(:patch, "/api/v1/ai_settings", headers: admin.headers, body: { ai: { provider: "local", base_url: "http://169.254.169.254/v1", model: "llama3" } })
check "the cloud metadata address is refused", metadata.code == 422 && metadata.json.dig("error", "message").include?("never an AI service"), metadata.body[0, 250]
private_service = http.request(:patch, "/api/v1/ai_settings", headers: admin.headers, body: { ai: { provider: "openai_compatible", base_url: "https://192.168.1.50/v1", model: "m", api_key: "k" } })
check "an OpenAI-compatible service on a private network is pointed at the local choice", private_service.code == 422 && private_service.json.dig("error", "message").include?("Local model"), private_service.body[0, 250]
plain = http.request(:patch, "/api/v1/ai_settings", headers: admin.headers, body: { ai: { provider: "openai_compatible", base_url: "http://203.0.113.10/v1", model: "m", api_key: "k" } })
check "…and one over plain http is refused", plain.code == 422 && plain.json.dig("error", "message") == "Address must start with https://", plain.body[0, 250]
check "nothing was saved by any of that", http.request(:get, "/api/v1/ai_settings", headers: admin.headers).json.dig("ai", "source").nil?

# ── A local model, on this machine ──
model = LocalModel.new
local = { provider: "local", base_url: model.url, model: "llama3" }
tried = http.request(:post, "/api/v1/ai_settings/test", headers: admin.costly, body: { ai: local })
check "Try it reaches the model and says it is connected", tried.code == 200 && tried.json["success"] == true && tried.json["message"].start_with?("Connected. 127.0.0.1 answered in") && tried.json["reply"] == "ready", tried.body[0, 300]
seen = model.requests.last
check "…asking only the fixed question, with no key, and none of the company's data",
      seen[:line] == "POST /v1/chat/completions HTTP/1.1" && seen[:json]["model"] == "llama3" && seen[:json]["max_tokens"] == 32 && seen[:json]["messages"] == [{ "role" => "user", "content" => "Reply with the single word: ready" }] && !seen[:headers].key?("authorization"), seen.inspect
check "…and nothing was saved by trying", http.request(:get, "/api/v1/ai_settings", headers: admin.headers).json.dig("ai", "source").nil?

saved = http.request(:patch, "/api/v1/ai_settings", headers: admin.headers, body: { ai: local })
check "the local model is saved", saved.code == 200 && saved.json.dig("ai", "provider") == "local" && saved.json.dig("ai", "enabled") == true && saved.json.dig("ai", "where") == "127.0.0.1" && saved.json.dig("ai", "source") == "app", saved.body[0, 300]
config = http.request(:get, "/api/v1/ai/config", headers: manager).json["data"]
check "everyone is told AI is on, with the model", config["enabled"] == true && config["provider"] == "local" && config["model"] == "llama3", config.inspect

# ── The assistant answers from it ──
model.requests.clear
answer = http.request(:post, "/api/v1/ai/assist", headers: technician.costly, body: { work_order_id: work_order_id, message: "What should I check first?" })
frames = answer.body.scan(/^data: (.+)$/).flatten.map { |line| JSON.parse(line) }
text = frames.filter_map { |frame| frame["text"] }.join
check "the technician's question is answered from the local model, streamed in pieces", answer.code == 200 && answer.headers["content-type"].to_s.include?("text/event-stream") && text == "Check the seal, ünd 世界." && frames.last["done"] == true, answer.body[0, 400]
check "…in several pieces, not all at once", frames.count { |frame| frame["text"] } == 4, frames.inspect
sent = model.requests.last
system = sent[:json]["messages"].first
check "…the model was told about this work order, and the question went with it",
      sent[:json]["stream"] == true && system["role"] == "system" && system["content"].include?("AI check: pump seal is weeping") && system["content"].include?("Oil on the floor") && sent[:json]["messages"].last == { "role" => "user", "content" => "What should I check first?" }, system.to_s[0, 300]
check "…and no one's login or email went with it", !sent[:json].to_json.match?(/password|@/i) || sent[:json].to_json.scan(/\S+@\S+/).none? { |m| m.include?(ADMIN[0]) || m.include?(TECH[0]) }

# ── A key: kept, not shown, and dropped when the host changes ──
with_key = http.request(:patch, "/api/v1/ai_settings", headers: admin.headers, body: { ai: local.merge(api_key: "secret-local-key-123") })
check "a key can be saved with it, and is never sent back", with_key.code == 200 && with_key.json.dig("ai", "providers", "local", "key_set") == true && !with_key.body.include?("secret-local-key-123"), with_key.body[0, 300]
check "…nor on reading the settings again", !http.request(:get, "/api/v1/ai_settings", headers: admin.headers).body.include?("secret-local-key-123")
model.requests.clear
http.request(:post, "/api/v1/ai/assist", headers: technician.costly, body: { work_order_id: work_order_id, message: "Again?" })
check "…and it is sent to the model as a bearer login", model.requests.last && model.requests.last[:headers]["authorization"] == "Bearer secret-local-key-123", model.requests.last.inspect
http.request(:patch, "/api/v1/ai_settings", headers: admin.headers, body: { ai: { provider: "local", model: "llama3", api_key: "" } })
model.requests.clear
http.request(:post, "/api/v1/ai/assist", headers: technician.costly, body: { work_order_id: work_order_id, message: "Once more?" })
check "a blank key in the form keeps the saved one", model.requests.last && model.requests.last[:headers]["authorization"] == "Bearer secret-local-key-123", model.requests.last.inspect

moved = http.request(:patch, "/api/v1/ai_settings", headers: admin.headers, body: { ai: { provider: "local", base_url: "http://localhost:#{model.port}/v1", model: "llama3", api_key: "" } })
check "moving the address to another host drops the key (a local model needs none)", moved.code == 200 && moved.json.dig("ai", "providers", "local", "key_set") == false && moved.json.dig("ai", "where") == "localhost", moved.body[0, 300]
model.requests.clear
http.request(:post, "/api/v1/ai/assist", headers: technician.costly, body: { work_order_id: work_order_id, message: "And now?" })
check "…so the old key is not sent to the new host", model.requests.last && !model.requests.last[:headers].key?("authorization") && model.requests.last[:line].include?("/v1/chat/completions"), model.requests.last.inspect

# ── What goes wrong is said in words, and the key is not repeated ──
http.request(:patch, "/api/v1/ai_settings", headers: admin.headers, body: { ai: local.merge(api_key: "leaky-key-456") })
model.answers << 401
refused = http.request(:post, "/api/v1/ai_settings/test", headers: admin.costly, body: { ai: local })
check "a refused key is reported without repeating the key, even when the service quotes it",
      refused.code == 422 && refused.json.dig("error", "message") == "127.0.0.1 did not accept the key." && !refused.body.include?("leaky-key-456"), refused.body[0, 300]
model.answers << 404
unknown = http.request(:post, "/api/v1/ai_settings/test", headers: admin.costly, body: { ai: local })
check "an unknown model is reported with what the service said", unknown.code == 422 && unknown.json.dig("error", "message") == "127.0.0.1 refused the request (404): model 'nope' not found.", unknown.body[0, 300]
model.answers << 500
broken = http.request(:post, "/api/v1/ai_settings/test", headers: admin.costly, body: { ai: local })
check "a service error is reported as such", broken.code == 422 && broken.json.dig("error", "message") == "127.0.0.1 had a problem (500).", broken.body[0, 300]
model.answers << 401
streamed = http.request(:post, "/api/v1/ai/assist", headers: technician.costly, body: { work_order_id: work_order_id, message: "Fail please" })
check "the assistant shows the same words in its stream, not a server error", streamed.code == 200 && streamed.body.include?('"error":"127.0.0.1 did not accept the key."') && !streamed.body.include?("leaky-key-456"), streamed.body[0, 300]

model.stop
sleep 0.3
down = http.request(:post, "/api/v1/ai_settings/test", headers: admin.costly, body: { ai: local })
check "a model that is not running is reported as that", down.code == 422 && down.json.dig("error", "message") == "Nothing is answering at 127.0.0.1. Is the service running?", down.body[0, 300]

# ── Off again, and forgetting ──
off = http.request(:patch, "/api/v1/ai_settings", headers: admin.headers, body: { ai: { provider: "none" } })
check "AI is switched off, and what was set up is kept", off.code == 200 && off.json.dig("ai", "enabled") == false && off.json.dig("ai", "providers", "local", "model") == "llama3" && off.json.dig("ai", "providers", "local", "key_set") == true, off.body[0, 300]
check "…the assistant is refused again, and everyone is told", http.request(:post, "/api/v1/ai/assist", headers: technician.costly, body: { work_order_id: work_order_id, message: "x" }).code == 503 && http.request(:get, "/api/v1/ai/config", headers: manager).json.dig("data", "enabled") == false
forgot = http.request(:delete, "/api/v1/ai_settings", headers: admin.headers)
check "forgetting removes it all", forgot.code == 200 && forgot.json.dig("ai", "source").nil? && forgot.json.dig("ai", "providers", "local").to_h.slice("model", "base_url", "key_set") == { "key_set" => false }, forgot.body[0, 300]

# ── The audit log, and the limit ──
log = http.request(:get, "/api/v1/activity_logs?per_page=50", headers: admin.headers)
check "the audit log has what changed, and no key", log.code == 200 && log.body.include?("ai_settings.updated") && log.body.include?("ai_settings.removed") && !log.body.include?("secret-local-key-123") && !log.body.include?("leaky-key-456"), log.body[0, 200]
limited = sign_in(http, ADMIN)
codes = 6.times.map { http.request(:post, "/api/v1/ai_settings/test", headers: limited, body: { ai: { provider: "none" } }).code }
check "the Try it button is limited to five a minute", codes == [422, 422, 422, 422, 422, 429], codes.inspect
check "…while reading the settings is not", 8.times.all? { http.request(:get, "/api/v1/ai_settings", headers: limited).code == 200 }

puts
puts "#{$checks - $failures.size} of #{$checks} checks passed"
exit($failures.empty? ? 0 : 1)
