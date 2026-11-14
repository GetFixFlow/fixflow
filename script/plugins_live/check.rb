# Tries the two sample plugins against a running FixFlow (API server and Sidekiq) the way people do: an administrator switches
# them on, a manager opens the reports and downloads one, and the ntfy channel delivers a real notification (a work order is
# assigned, so the API, a background job, the plugin and a real HTTP receiver that stands in for an ntfy server are all in the
# path). Prints one line for each thing it checks.
#
#   API=http://localhost:3077 ADMIN_EMAIL=... ADMIN_PASSWORD=... MANAGER_EMAIL=... MANAGER_PASSWORD=... \
#   TECH_EMAIL=... TECH_PASSWORD=... RECEIVER_HOST=192.168.1.11 ruby script/plugins_live/check.rb
#
# Before it runs, copy examples/plugins/overdue_work and examples/plugins/ntfy (and, to see a plugin that cannot load, a folder
# called `broken` holding a plugin.rb that raises) into the plugins folder of the server, and start the server and Sidekiq. The
# receiver must be reachable by FixFlow at an address FixFlow allows, which is not its own loopback: set RECEIVER_HOST to this
# computer's address on the network. Some checks wait for background jobs, so Sidekiq must be running with the notifications queue.
require "net/http"
require "json"
require "uri"
require "socket"
require "time"

API = ENV.fetch("API", "http://localhost:3077")
ADMIN = [ENV.fetch("ADMIN_EMAIL"), ENV.fetch("ADMIN_PASSWORD")].freeze
MANAGER = [ENV.fetch("MANAGER_EMAIL"), ENV.fetch("MANAGER_PASSWORD")].freeze
TECH = [ENV.fetch("TECH_EMAIL"), ENV.fetch("TECH_PASSWORD")].freeze
RECEIVER_HOST = ENV.fetch("RECEIVER_HOST")
EXPECT_BROKEN = ENV.fetch("EXPECT_BROKEN", "yes") == "yes"

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

# ── A receiver standing in for an ntfy server: records what it is sent and answers as told ──
class Receiver
  attr_reader :messages
  attr_accessor :answers # statuses to answer with, in turn; 200 when empty

  def initialize(host)
    @server = TCPServer.new(host, 0)
    @messages = []
    @answers = []
    @thread = Thread.new { serve }
  end

  def url = "http://#{@server.addr[3]}:#{@server.addr[1]}"

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
    socket.write("HTTP/1.1 #{status} X\r\nContent-Length: 2\r\nConnection: close\r\n\r\n{}")
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

def sign_in(http, credentials)
  response = http.request(:post, "/api/v1/auth/sign_in", body: { user: { email: credentials[0], password: credentials[1] } })
  raise "sign-in failed for #{credentials[0]}: #{response.code} #{response.body[0, 200]}" unless response.code == 200

  [{ "Authorization" => response.headers["authorization"] }, response.json.dig("data", "user") || response.json["user"]]
end

# Sign-in is limited to 10 a minute for one address: three people sign in here, and no more.
admin, = sign_in(http, ADMIN)
manager, = sign_in(http, MANAGER)
tech, tech_user = sign_in(http, TECH)
tech_id = tech_user&.fetch("id") || http.request(:get, "/api/v1/users/me", headers: tech).json.dig("data", "id")
check "an administrator, a manager and a technician sign in", [admin, manager, tech].all? { |h| h["Authorization"].to_s.start_with?("Bearer") }

# ── What is installed ──
listing = http.request(:get, "/api/v1/plugins", headers: admin)
check "the administrator lists the plugins", listing.code == 200, listing.body[0, 200]
plugins = listing.json["plugins"].to_h { |plugin| [plugin["key"], plugin] }
check "both samples loaded, switched off", %w[overdue_work ntfy].all? { |key| plugins[key] && plugins[key]["enabled"] == false }, plugins.keys.inspect
check "overdue_work adds two reports, ntfy a channel",
      plugins.dig("overdue_work", "reports")&.map { |r| r["key"] } == %w[overdue_now finished_late] && plugins.dig("ntfy", "channels")&.map { |c| c["key"] } == ["ntfy"]
if EXPECT_BROKEN
  check "a plugin that raises when loaded is listed with the reason, and the server carries on",
        listing.json["failures"].any? { |f| f["folder"] == "broken" && f["message"].include?("RuntimeError") }, listing.json["failures"].inspect
end
check "a manager cannot list or set up plugins", %i[get].all? { http.request(:get, "/api/v1/plugins", headers: manager).code == 403 } &&
                                                 http.request(:patch, "/api/v1/plugins/ntfy", body: { plugin: { enabled: true } }, headers: manager).code == 403
check "a technician cannot either", http.request(:get, "/api/v1/plugins", headers: tech).code == 403

# ── Reports ──
check "reports of a plugin that is off are hidden from managers",
      http.request(:get, "/api/v1/plugin_reports", headers: manager).json["reports"].empty?
off = http.request(:get, "/api/v1/plugin_reports/overdue_work/overdue_now", headers: manager)
check "…and cannot be run, with the reason in words", off.code == 404 && off.json.dig("error", "code") == "PLUGIN_OFF", off.body[0, 200]

on = http.request(:patch, "/api/v1/plugins/overdue_work", body: { plugin: { enabled: true } }, headers: admin)
check "the administrator switches overdue_work on", on.code == 200 && on.json.dig("plugin", "enabled") == true, on.body[0, 200]
check "the manager now sees its two reports",
      http.request(:get, "/api/v1/plugin_reports", headers: manager).json["reports"].map { |r| r["key"] } == %w[overdue_now finished_late]
check "a technician still cannot run one", http.request(:get, "/api/v1/plugin_reports/overdue_work/overdue_now", headers: tech).code == 403

asset = http.request(:get, "/api/v1/assets", headers: manager).json["assets"].first
late = http.request(:post, "/api/v1/work_orders", headers: manager,
                                                  body: { work_order: { title: "Plugin check: belt is slipping", asset_id: asset["id"], priority: "high",
                                                                        due_date: (Time.now - 3 * 86_400).iso8601 } })
check "a work order that is already late is made", late.code == 201, late.body[0, 300]
late_id = late.json.dig("data", "id")
assigned = http.request(:patch, "/api/v1/work_orders/#{late_id}/assign", body: { assignee_id: tech_id }, headers: manager)
check "…and given to the technician (before the channel is on, so no message yet)", assigned.code == 200, assigned.body[0, 300]

overdue = http.request(:get, "/api/v1/plugin_reports/overdue_work/overdue_now", headers: manager)
table = overdue.json["table"]
mine = table["rows"].find { |row| row[0] == tech_user&.fetch("full_name", nil) } || table["rows"].first
check "Overdue now lists the late work for the person it is assigned to",
      overdue.code == 200 && table["columns"].map { |c| c["key"] } == %w[person overdue urgent oldest] && mine && mine[1] >= 1 && mine[2] >= 1, overdue.body[0, 300]
check "…as of now, so it was given no period", overdue.json["report"]["period"] == false && overdue.json["from"].nil?
finished = http.request(:get, "/api/v1/plugin_reports/overdue_work/finished_late?from=#{(Date.today - 30).iso8601}&to=#{Date.today.iso8601}", headers: manager)
check "Finished late answers for a period", finished.code == 200 && finished.json["table"]["columns"].last["kind"] == "percent", finished.body[0, 300]
bad_period = http.request(:get, "/api/v1/plugin_reports/overdue_work/finished_late?from=2026-11-05&to=2026-11-01", headers: manager)
check "a period that ends before it starts is refused", bad_period.code == 400
csv = http.request(:get, "/api/v1/plugin_reports/overdue_work/overdue_now.csv", headers: manager)
check "the report downloads as a spreadsheet",
      csv.code == 200 && csv.headers["content-type"].to_s.start_with?("text/csv") && csv.body.include?("Overdue work orders") && csv.headers["content-disposition"].to_s.include?("overdue_work_overdue_now"),
      csv.headers.inspect

# ── The notification channel ──
receiver = Receiver.new(RECEIVER_HOST)
topic = "workshop-#{rand(10**8)}"
channel = plugins.dig("ntfy", "channels", 0)
check "the ntfy channel's form is described by its fields", channel["fields"].map { |f| [f["key"], f["kind"]] } == [%w[server url], %w[topic text], %w[token secret], %w[priority select]], channel["fields"].inspect

http.request(:patch, "/api/v1/plugins/ntfy", body: { plugin: { enabled: true } }, headers: admin)
refused = http.request(:put, "/api/v1/plugins/ntfy/channels/ntfy", headers: admin,
                                                                   body: { channel: { enabled: true, values: { server: "http://127.0.0.1:3000", topic: topic } } })
check "an address on the server itself is refused", refused.code == 422 && refused.json.dig("error", "message").include?("points at this server"), refused.body[0, 200]
no_topic = http.request(:put, "/api/v1/plugins/ntfy/channels/ntfy", headers: admin, body: { channel: { enabled: true, values: { server: receiver.url } } })
check "a channel that is switched on needs its topic", no_topic.code == 422 && no_topic.json.dig("error", "message") == "Topic is needed.", no_topic.body[0, 200]

test_values = { server: receiver.url, topic: topic, token: "tk_live_secret", priority: "high" }
tested = http.request(:post, "/api/v1/plugins/ntfy/channels/ntfy/test", headers: admin, body: { channel: { values: test_values } })
check "the Test button delivers through the real plugin to the receiver", tested.code == 200 && tested.json["success"] == true, tested.body[0, 300]
sent = receiver.messages.last
payload = sent && JSON.parse(sent[:body])
check "…as ntfy's JSON, with the topic, priority and the token as a bearer login",
      sent && payload["topic"] == topic && payload["title"] == "FixFlow is connected" && payload["priority"] == 4 && sent[:headers]["authorization"] == "Bearer tk_live_secret" &&
      sent[:headers]["content-type"] == "application/json" && sent[:headers]["user-agent"] == "FixFlow-Plugin/1", sent.inspect
check "…and nothing was saved by testing", http.request(:get, "/api/v1/plugins", headers: admin).json["plugins"].find { |p| p["key"] == "ntfy" }["channels"][0]["secrets_set"] == { "token" => false }

saved = http.request(:put, "/api/v1/plugins/ntfy/channels/ntfy", headers: admin,
                                                                 body: { channel: { enabled: true, events: %w[wo_assigned], values: test_values } })
check "the channel is saved, hearing only work orders being assigned", saved.code == 200 && saved.json.dig("plugin", "channels", 0, "enabled") == true, saved.body[0, 300]
check "…and the saved secret is never sent back", !saved.body.include?("tk_live_secret") && saved.json.dig("plugin", "channels", 0, "secrets_set") == { "token" => true }

# A real notification: assigning work goes API -> background job -> ChatNotifier -> plugin channel job -> receiver.
receiver.messages.clear
second = http.request(:post, "/api/v1/work_orders", headers: manager,
                                                    body: { work_order: { title: "Plugin check: pump 3 is leaking", asset_id: asset["id"], priority: "critical" } })
second_id = second.json.dig("data", "id")
http.request(:patch, "/api/v1/work_orders/#{second_id}/assign", body: { assignee_id: tech_id }, headers: manager)
arrived = wait_for(30) { receiver.messages.find { |m| m[:body].include?("leaking") } }
body = arrived && JSON.parse(arrived[:body])
check "assigning work sends a real notification through the plugin, in the background",
      arrived && body["topic"] == topic && body["title"].include?("assigned to") && body["message"] == "Plugin check: pump 3 is leaking" && body["priority"] == 4 && body["click"].to_s.include?("/work-orders/#{second_id}") &&
      body["tags"] == ["wrench"], arrived.inspect
state = wait_for(15) { (c = http.request(:get, "/api/v1/plugins", headers: admin).json["plugins"].find { |p| p["key"] == "ntfy" }["channels"][0])["last_sent_at"] && c }
check "the channel remembers when the last message went out", state && state["last_error"].nil?, state.inspect

# Events it did not tick are not sent.
receiver.messages.clear
http.request(:post, "/api/v1/work_orders", headers: manager, body: { work_order: { title: "Plugin check: a quiet one", asset_id: asset["id"], priority: "low" } })
sleep 3
check "an event the channel did not tick sends nothing", receiver.messages.empty?, receiver.messages.inspect

# A service that refuses is a reason in words, with no retries.
receiver.messages.clear
receiver.answers = [403]
third = http.request(:post, "/api/v1/work_orders", headers: manager, body: { work_order: { title: "Plugin check: refused", asset_id: asset["id"], priority: "low" } })
http.request(:patch, "/api/v1/work_orders/#{third.json.dig('data', 'id')}/assign", body: { assignee_id: tech_id }, headers: manager)
failed = wait_for(30) { (c = http.request(:get, "/api/v1/plugins", headers: admin).json["plugins"].find { |p| p["key"] == "ntfy" }["channels"][0])["last_error"] && c }
check "a refusing service shows its reason on the channel", failed && failed["last_error"].include?("(403)"), failed.inspect
sleep 5
check "…and the refused message is not sent again", receiver.messages.size == 1, receiver.messages.size.to_s

# A service that is down is tried again later (30 seconds), and gets through.
receiver.messages.clear
receiver.answers = [503]
fourth = http.request(:post, "/api/v1/work_orders", headers: manager, body: { work_order: { title: "Plugin check: retried", asset_id: asset["id"], priority: "low" } })
http.request(:patch, "/api/v1/work_orders/#{fourth.json.dig('data', 'id')}/assign", body: { assignee_id: tech_id }, headers: manager)
retried = wait_for(75) { receiver.messages.size >= 2 }
check "a service that answers 503 is tried again about 30 seconds later", retried && (receiver.messages[1][:at] - receiver.messages[0][:at]).between?(25, 60), receiver.messages.map { |m| m[:at] }.inspect
after = wait_for(15) { (c = http.request(:get, "/api/v1/plugins", headers: admin).json["plugins"].find { |p| p["key"] == "ntfy" }["channels"][0])["last_error"].nil? && c }
check "…and the earlier error is cleared once it gets through", after, nil

# Switching the plugin off silences it.
http.request(:patch, "/api/v1/plugins/ntfy", body: { plugin: { enabled: false } }, headers: admin)
receiver.messages.clear
fifth = http.request(:post, "/api/v1/work_orders", headers: manager, body: { work_order: { title: "Plugin check: silenced", asset_id: asset["id"], priority: "low" } })
http.request(:patch, "/api/v1/work_orders/#{fifth.json.dig('data', 'id')}/assign", body: { assignee_id: tech_id }, headers: manager)
sleep 5
check "switched off, the channel sends nothing", receiver.messages.empty?, receiver.messages.inspect

audit = http.request(:get, "/api/v1/activity_logs?per_page=50", headers: admin).body
check "the audit log says plugins were switched on and a channel changed", audit.include?("plugin.enabled") && audit.include?("plugin.channel_updated") && !audit.include?("tk_live_secret")

receiver.stop
puts "\n#{$checks - $failures.size} of #{$checks} checks passed"
unless $failures.empty?
  puts "Failed: #{$failures.join('; ')}"
  exit 1
end
