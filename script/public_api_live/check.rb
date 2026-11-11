# Tries the public API, API keys and webhooks against a running FixFlow (API server and Sidekiq) the way a program does:
# makes keys, calls /api/v1/open, and receives webhook messages on a real HTTP receiver that checks their signatures with the
# same code the documentation gives (docs/public-api.md). Prints one line for each thing it checks.
#
#   API=http://localhost:3077 ADMIN_EMAIL=... ADMIN_PASSWORD=... RECEIVER_HOST=192.168.1.11 ruby script/public_api_live/check.rb
#
# The receiver must be reachable by FixFlow at an address FixFlow allows, which is not its own loopback: set RECEIVER_HOST to
# this computer's address on the network. The checks wait for FixFlow's background jobs (Sidekiq must be running).
require "net/http"
require "json"
require "uri"
require "socket"
require "openssl"
require "securerandom"
require "time"

API = ENV.fetch("API", "http://localhost:3077")
ADMIN_EMAIL = ENV.fetch("ADMIN_EMAIL")
ADMIN_PASSWORD = ENV.fetch("ADMIN_PASSWORD")
RECEIVER_HOST = ENV.fetch("RECEIVER_HOST")

$failures = []
$checks = 0

def check(name, ok, detail = nil)
  $checks += 1
  puts "#{ok ? 'PASS' : 'FAIL'}  #{name}#{detail && !ok ? "  -> #{detail}" : ''}"
  $failures << name unless ok
end

def wait_for(seconds = 30)
  deadline = Time.now + seconds
  loop do
    result = yield
    return result if result
    return nil if Time.now > deadline

    sleep 0.5
  end
end

# The check the documentation gives (Ruby tab).
def verify(raw_body, header, secret, tolerance: 300)
  parts = header.split(",").to_h { |part| part.split("=", 2) }
  return false unless parts["t"] && parts["v1"]
  return false if (Time.now.to_i - parts["t"].to_i).abs > tolerance

  expected = OpenSSL::HMAC.hexdigest("SHA256", secret, "#{parts['t']}.#{raw_body}")
  expected.bytesize == parts["v1"].bytesize && OpenSSL.fixed_length_secure_compare(expected, parts["v1"])
end

# ── A receiver: a real HTTP server that records what it is sent and answers as told ──
class Receiver
  attr_reader :messages, :port
  attr_accessor :answers # statuses to answer with, in turn; 200 when empty

  def initialize(host)
    @server = TCPServer.new(host, 0)
    @port = @server.addr[1]
    @messages = []
    @answers = []
    @thread = Thread.new { serve }
  end

  def url(path = "/hook") = "http://#{@server.addr[3]}:#{@port}#{path}"

  def stop
    @thread.kill
    @server.close
  end

  private

  def serve
    loop do
      client = @server.accept
      Thread.new(client) { |socket| handle(socket) }
    end
  end

  def handle(socket)
    request_line = socket.gets.to_s
    headers = {}
    while (line = socket.gets) && line != "\r\n"
      name, value = line.split(": ", 2)
      headers[name.downcase] = value.to_s.strip
    end
    body = socket.read(headers["content-length"].to_i).to_s
    @messages << { request_line: request_line.strip, headers: headers, body: body, at: Time.now }
    status = @answers.shift || 200
    socket.write("HTTP/1.1 #{status} X\r\nContent-Length: 2\r\nConnection: close\r\n\r\nok")
  ensure
    socket.close
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
    res = Net::HTTP.start(uri.host, uri.port, read_timeout: 60) { |http| http.request(req) }
    Response.new(res.code.to_i, res.each_header.to_h, res.body.to_s)
  end
end

http = Client.new
bearer = ->(key) { { "Authorization" => "Bearer #{key}" } }

# ── The administrator makes keys ──
signin = http.request(:post, "/api/v1/auth/sign_in", body: { user: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } })
check "the administrator signs in", signin.code == 200, signin.body[0, 200]
admin = { "Authorization" => signin.headers["authorization"] }

read_key = http.request(:post, "/api/v1/api_keys", body: { api_key: { name: "Reports script", scopes: %w[read] } }, headers: admin).json["data"]
write_key = http.request(:post, "/api/v1/api_keys", body: { api_key: { name: "n8n", scopes: %w[read write] } }, headers: admin).json["data"]
iot_key = http.request(:post, "/api/v1/api_keys", body: { api_key: { name: "Gateway", scopes: %w[iot] } }, headers: admin).json["data"]
check "keys are made, shown once, with a prefix", [ read_key, write_key, iot_key ].all? { |k| k["key"].to_s.start_with?("fxk_") && k["prefix"] == k["key"][0, 12] }
listing = http.request(:get, "/api/v1/api_keys", headers: admin)
check "the list never shows a key's secret", [ read_key, write_key, iot_key ].none? { |k| listing.body.include?(k["key"]) }

# ── The public API ──
me = http.request(:get, "/api/v1/open/me", headers: bearer.(read_key["key"]))
check "a key says who it is (test connection)", me.code == 200 && me.json.dig("data", "key", "scopes") == %w[read], me.body[0, 200]
check "the OpenAPI description needs no key", http.request(:get, "/api/v1/open/openapi").json["openapi"] == "3.0.3"
check "a wrong key is 401", http.request(:get, "/api/v1/open/me", headers: bearer.("fxk_#{'0' * 64}")).code == 401
check "a key in the address is refused", http.request(:get, "/api/v1/open/me?api_key=#{read_key['key']}").code == 400
check "a read key reads", http.request(:get, "/api/v1/open/work_orders", headers: bearer.(read_key["key"])).code == 200
refused = http.request(:post, "/api/v1/open/work_orders", body: { work_order: { title: "No" } }, headers: bearer.(read_key["key"]))
check "a read key may not write", refused.code == 403 && refused.json.dig("error", "code") == "INSUFFICIENT_SCOPE", refused.body[0, 200]
sensor_only = http.request(:get, "/api/v1/open/work_orders", headers: bearer.(iot_key["key"]))
check "a sensor key may not use the public API", sensor_only.code == 403
check "a person's session token is not a key", http.request(:get, "/api/v1/open/me", headers: admin).code == 401

# ── Webhooks, received for real ──
receiver = Receiver.new(RECEIVER_HOST)
made = http.request(:post, "/api/v1/webhooks", headers: admin,
                    body: { webhook: { name: "Live receiver", url: receiver.url, events: %w[work_order.created work_order.assigned work_order.started work_order.completed] } })
check "a webhook is made, with its secret once", made.code == 201 && made.json["secret"].to_s.start_with?("whsec_"), made.body[0, 300]
secret = made.json["secret"]
hook_id = made.json.dig("webhook", "id")
bad = http.request(:post, "/api/v1/webhooks", headers: admin, body: { webhook: { name: "Loopback", url: "http://127.0.0.1:9/x", events: %w[work_order.created] } })
check "an address at the server itself is refused", bad.code == 422 && bad.json.dig("error", "message").to_s.include?("this server"), bad.body[0, 200]

test = http.request(:post, "/api/v1/webhooks/#{hook_id}/test", headers: admin)
ping = receiver.messages.last
check "the test message is delivered, and the answer is shown", test.code == 200 && test.json.dig("delivery", "status") == "delivered" && test.json.dig("delivery", "response_code") == 200, test.body[0, 300]
check "the receiver checks the signature with the documented code", ping && verify(ping[:body], ping[:headers]["x-fixflow-signature"], secret), ping&.fetch(:headers)&.inspect
check "the message says what it is", ping && ping[:headers].values_at("x-fixflow-event", "user-agent") == [ "ping", "FixFlow-Webhooks/1" ] && JSON.parse(ping[:body])["id"] == ping[:headers]["x-fixflow-delivery"]
check "a wrong secret fails the check", ping && !verify(ping[:body], ping[:headers]["x-fixflow-signature"], "whsec_wrong")
check "a changed body fails the check", ping && !verify("#{ping[:body]} ", ping[:headers]["x-fixflow-signature"], secret)

# a work order made through the API, taken through its life by the API
asset = http.request(:post, "/api/v1/open/assets", headers: bearer.(write_key["key"]), body: { asset: { name: "Live pump", status: "operational" } }).json["data"]
created = http.request(:post, "/api/v1/open/work_orders", headers: bearer.(write_key["key"]),
                       body: { work_order: { title: "Live leak", description: "From a program", priority: "high", asset_id: asset["id"] } })
check "a write key makes a work order", created.code == 201 && created.json.dig("data", "requester", "name") == "n8n", created.body[0, 300]
work_order = created.json["data"]
got = wait_for { receiver.messages.find { |m| m[:headers]["x-fixflow-event"] == "work_order.created" } }
check "work_order.created reaches the receiver, signed, with the same shape the API answers", got && verify(got[:body], got[:headers]["x-fixflow-signature"], secret) &&
  JSON.parse(got[:body]).dig("data", "work_order", "title") == "Live leak", got&.fetch(:body)
check "the webhook message carries no wage figures", got && !got[:body].match?(/labor_cost|labor_rate|hourly_rate/)

tech = http.request(:get, "/api/v1/users?role=technician", headers: admin).json["users"]&.first
assign = http.request(:post, "/api/v1/open/work_orders/#{work_order['id']}/transitions", headers: bearer.(write_key["key"]), body: { event: "assign", assignee_id: tech&.dig("id") })
check "a write key assigns it", assign.code == 200 && assign.json.dig("data", "status") == "assigned", assign.body[0, 300]
check "work_order.assigned arrives", wait_for { receiver.messages.find { |m| m[:headers]["x-fixflow-event"] == "work_order.assigned" } }
http.request(:post, "/api/v1/open/work_orders/#{work_order['id']}/transitions", headers: bearer.(write_key["key"]), body: { event: "start" })
done = http.request(:post, "/api/v1/open/work_orders/#{work_order['id']}/transitions", headers: bearer.(write_key["key"]), body: { event: "complete", completion_notes: "Replaced the seal", actual_hours: 1.5 })
check "and completes it", done.code == 200 && done.json.dig("data", "status") == "completed" && done.json.dig("data", "actual_hours") == 1.5, done.body[0, 300]
completed = wait_for { receiver.messages.find { |m| m[:headers]["x-fixflow-event"] == "work_order.completed" } }
payload = completed && JSON.parse(completed[:body])
check "work_order.completed arrives with the notes and the status change", payload && payload.dig("data", "work_order", "completion_notes") == "Replaced the seal" &&
  payload["changes"] == { "status" => %w[in_progress completed] }, completed&.fetch(:body)
check "every message of a delivery has its own id and the attempt number", receiver.messages.map { |m| m[:headers]["x-fixflow-attempt"] }.uniq == [ "1" ]
audit = http.request(:get, "/api/v1/activity_logs?action=work_order.created", headers: admin).json["activity_logs"].to_a
check "the audit log names the key that made it", audit.any? { |l| l.dig("metadata", "api_key").to_s.start_with?("n8n") }, audit.first&.inspect

# the receiver is having trouble: the message is tried again (the first retry is after a minute)
receiver.answers = [ 503 ]
before = receiver.messages.size
http.request(:post, "/api/v1/open/work_orders", headers: bearer.(write_key["key"]), body: { work_order: { title: "Retry me" } })
first = wait_for { receiver.messages.size > before && receiver.messages.last }
check "a message the receiver refuses (503) is noted as pending, with the answer", first && wait_for(10) {
  http.request(:get, "/api/v1/webhooks/#{hook_id}", headers: admin).json["deliveries"].any? { |d| d["status"] == "pending" && d["response_code"] == 503 && d["next_attempt_at"] }
}
puts "   (waiting for the retry, due after a minute)"
retried = wait_for(150) { receiver.messages.count { |m| m[:headers]["x-fixflow-attempt"] == "2" } >= 1 }
check "and is sent again by itself, as attempt 2", retried
delivered = wait_for(20) { http.request(:get, "/api/v1/webhooks/#{hook_id}", headers: admin).json["deliveries"].any? { |d| d["event"] == "work_order.created" && d["attempts"] == 2 && d["status"] == "delivered" } }
check "the log shows it delivered on the second attempt", delivered

# a changed secret: the old one stops signing at once
rotated = http.request(:post, "/api/v1/webhooks/#{hook_id}/rotate_secret", headers: admin).json["secret"]
http.request(:post, "/api/v1/webhooks/#{hook_id}/test", headers: admin)
last = receiver.messages.last
check "after renewing the secret, messages are signed with the new one only", last && verify(last[:body], last[:headers]["x-fixflow-signature"], rotated) && !verify(last[:body], last[:headers]["x-fixflow-signature"], secret)

# a receiver that is gone
receiver.answers = [ 410 ]
http.request(:post, "/api/v1/webhooks/#{hook_id}/test", headers: admin)
gone = http.request(:get, "/api/v1/webhooks/#{hook_id}", headers: admin).json["webhook"]
check "a receiver that answers 410 Gone is switched off, with the reason", gone["enabled"] == false && gone["disabled_reason"].to_s.include?("410"), gone.inspect
http.request(:post, "/api/v1/webhooks/#{hook_id}/enable", headers: admin)
check "and can be switched on again", http.request(:get, "/api/v1/webhooks/#{hook_id}", headers: admin).json.dig("webhook", "enabled") == true

# revoking a key stops it at once
http.request(:delete, "/api/v1/api_keys/#{write_key['id']}", headers: admin)
check "a revoked key stops working at once", http.request(:get, "/api/v1/open/me", headers: bearer.(write_key["key"])).code == 401
receiver.stop

puts
puts "#{$checks - $failures.size} of #{$checks} checks passed"
puts "FAILED: #{$failures.join('; ')}" if $failures.any?
exit($failures.empty? ? 0 : 1)
