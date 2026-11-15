# Tries several sites in one install (roadmap e08) against a running FixFlow (API server only), the way an administrator and the
# people at each site use it. It needs a company seeded with: sites "North plant" and "South plant" (each with a hall), a "Yard" (a
# top-level place that is not a site), assets "North pump", "South pump", "Yard pump" and "Placeless pump", work orders "North job",
# "South job" and "General job", parts "North belt", "South belt" and "Loose belt", another company with a pump, and people admin,
# manager, north, south and roamer (a technician each, none yet assigned to a site).
#
#   API=http://localhost:3081 ADMIN_EMAIL=... ADMIN_PASSWORD=... MANAGER_EMAIL=... MANAGER_PASSWORD=... NORTH_EMAIL=... NORTH_PASSWORD=... \
#   SOUTH_EMAIL=... SOUTH_PASSWORD=... ROAMER_EMAIL=... ROAMER_PASSWORD=... ruby script/live/check_sites.rb
require "net/http"
require "json"
require "uri"

API = ENV.fetch("API", "http://localhost:3081")
CREDENTIALS = %w[ADMIN MANAGER NORTH SOUTH ROAMER].to_h { |who| [who, [ENV.fetch("#{who}_EMAIL"), ENV.fetch("#{who}_PASSWORD")]] }.freeze

$failures = []
$checks = 0

def check(name, ok, detail = nil)
  $checks += 1
  puts "#{ok ? 'PASS' : 'FAIL'}  #{name}#{detail && !ok ? "  -> #{detail}" : ''}"
  $failures << name unless ok
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
get = ->(path, person) { request(:get, path, headers: who.fetch(person)) }
names = ->(path, key, person) { get.call(path, person).json[key].map { |row| row["name"] || row["title"] } }

check "five people sign in", who.values.all? { |h| h["Authorization"].to_s.start_with?("Bearer") }
everything = ["North pump", "South pump", "Yard pump", "Placeless pump"]

# ── Sites are off ──
state = get.call("/api/v1/sites", "ADMIN").json
check "sites are off, and the two sites made as places are listed", state["enabled"] == false && state["sites"].map { |s| s["name"] } == ["North plant", "South plant"], state.inspect[0, 300]
check "the yard (a top-level place that is not a site) is not listed as one", state["sites"].none? { |s| s["name"] == "Yard" }
north = state["sites"].find { |s| s["name"] == "North plant" }
south = state["sites"].find { |s| s["name"] == "South plant" }

# ── Setting sites up ──
east = request(:post, "/api/v1/sites", headers: who["ADMIN"], body: { site: { name: "East depot", settings: { timezone: "Asia/Colombo", work_hours: { start: "06:00", end: "14:00" }, work_days: %w[1 2 3 4 5 6], holidays: [{ date: "2026-11-19", name: "Depot day", repeating: false }] } } })
check "an administrator adds a site with its own calendar", east.code == 201 && east.json.dig("data", "effective", "timezone") == "Asia/Colombo" && east.json.dig("data", "settings", "work_days") == [1, 2, 3, 4, 5, 6], east.body[0, 300]
bad = request(:post, "/api/v1/sites", headers: who["ADMIN"], body: { site: { name: "Bad", settings: { timezone: "Mars/Olympus" } } })
check "a calendar that is not valid is refused in words", bad.code == 422 && bad.json.dig("error", "message").to_s.include?("time zone"), bad.body[0, 200]
check "a manager cannot add a site", request(:post, "/api/v1/sites", headers: who["MANAGER"], body: { site: { name: "Nope" } }).code == 403
request(:patch, "/api/v1/sites/#{north['id']}", headers: who["ADMIN"], body: { site: { settings: { work_hours: { start: "07:00", end: "12:00" }, holidays: [{ date: "2026-11-19", name: "North day", repeating: false }] } } })
check "a site's settings are changed, and the rest still follow the company", get.call("/api/v1/sites", "ADMIN").json["sites"].find { |s| s["id"] == north["id"] }["effective"].then { |e| e["work_hours"] == { "start" => "07:00", "end" => "12:00" } && e["work_days"] == [1, 2, 3, 4, 5] }
people = ->(site, ids) { request(:put, "/api/v1/sites/#{site['id']}/people", headers: who["ADMIN"], body: { user_ids: ids }) }
users = get.call("/api/v1/users?per_page=100", "ADMIN").json["users"].to_h { |u| [u["email"].split(".").first, u["id"]] }
check "people are assigned to sites", people.call(north, [users["north"]]).code == 200 && people.call(south, [users["south"]]).code == 200
check "an administrator cannot be assigned to a site, nor someone from elsewhere", people.call(north, [users["admin"]]).code == 422

# ── Still off: nothing changes ──
check "with sites off, a person assigned to a site still sees everything", names.call("/api/v1/assets", "assets", "NORTH").sort == everything.sort, names.call("/api/v1/assets", "assets", "NORTH").inspect

# ── Switch them on ──
on = request(:put, "/api/v1/sites/enabled", headers: who["ADMIN"], body: { enabled: true })
check "an administrator switches sites on, and a manager cannot", on.code == 200 && on.json["enabled"] == true && request(:put, "/api/v1/sites/enabled", headers: who["MANAGER"], body: { enabled: false }).code == 403

north_sees = names.call("/api/v1/assets", "assets", "NORTH")
check "a person at the north plant sees the north pump, the yard pump and the placeless pump, not the south pump", north_sees.sort == ["North pump", "Placeless pump", "Yard pump"].sort, north_sees.inspect
south_sees = names.call("/api/v1/assets", "assets", "SOUTH")
check "…and a person at the south plant the mirror of that", south_sees.sort == ["Placeless pump", "South pump", "Yard pump"].sort, south_sees.inspect
%w[ADMIN MANAGER ROAMER].each do |person|
  seen = names.call("/api/v1/assets", "assets", person)
  check "#{person.downcase} (an administrator, or assigned to no site) sees all four pumps", seen.sort == everything.sort, seen.inspect
end

assets = get.call("/api/v1/assets?per_page=100", "ADMIN").json["assets"]
south_pump = assets.find { |a| a["name"] == "South pump" }
orders = get.call("/api/v1/work_orders?per_page=100", "ADMIN").json
south_job = (orders["work_orders"] || orders["data"]).find { |w| w["title"] == "South job" }
check "another site's asset is not found by its number", get.call("/api/v1/assets/#{south_pump['id']}", "NORTH").code == 404
check "another site's work order is not found by its number, nor changed", get.call("/api/v1/work_orders/#{south_job['id']}", "NORTH").code == 404 && request(:patch, "/api/v1/work_orders/#{south_job['id']}", headers: who["NORTH"], body: { work_order: { title: "Hacked" } }).code == 404
north_jobs = names.call("/api/v1/work_orders?per_page=100", "work_orders", "NORTH")
check "the work orders listed are the north plant's and the general one", north_jobs.sort == ["General job", "North job"].sort, north_jobs.inspect
sneaky = request(:post, "/api/v1/work_orders", headers: who["NORTH"], body: { work_order: { title: "Sneaky", asset_id: south_pump["id"], priority: "low" } })
check "a work order cannot be put on another site's asset", sneaky.code == 422, sneaky.body[0, 200]
place_names = ->(person) { get.call("/api/v1/locations", person).json["locations"].map { |l| l["name"] } }
check "the place tree has the person's site and the yard, not the other site", place_names.call("NORTH").sort == ["North plant", "Yard"].sort, place_names.call("NORTH").inspect
check "a person's list of sites is theirs", get.call("/api/v1/sites", "NORTH").json.then { |j| j["sites"].map { |s| s["name"] } == ["North plant"] && j["my_site_ids"] == [north["id"]] }
parts = names.call("/api/v1/parts", "parts", "MANAGER")
check "a manager at no site sees all the parts", parts.sort == ["Loose belt", "North belt", "South belt"].sort, parts.inspect
check "the dashboard of a person at one site does not mention the other site", !get.call("/api/v1/dashboard", "NORTH").body.include?("South pump")

# ── The schedule and the report ──
schedule = request(:get, "/api/v1/schedule?from=2026-11-16&to=2026-11-22&site_id=#{north['id']}", headers: who["MANAGER"]).json["data"]
check "the schedule of the north plant has its working hours and its holiday, and its work", schedule["days"].find { |d| d["date"] == "2026-11-19" }.then { |d| d["holiday"] == "North day" && d["working"] == false } && schedule["days"].find { |d| d["date"] == "2026-11-17" }["hours"] == 5.0 && schedule["work_orders"].map { |w| w["title"] } == ["North job"], schedule["work_orders"].inspect
company = request(:get, "/api/v1/schedule?from=2026-11-16&to=2026-11-22", headers: who["MANAGER"]).json["data"]
check "without a site it is the company's calendar and all the work", company["days"].find { |d| d["date"] == "2026-11-19" }["holiday"].nil? && company["work_orders"].map { |w| w["title"] }.sort == ["General job", "North job", "South job"]
report = request(:get, "/api/v1/reports/sites?from=2026-11-01&to=2026-11-30", headers: who["MANAGER"]).json["data"]
rows = report["sites"].to_h { |r| [r["name"], r] }
check "the sites report has a line per site, with its assets and open work", rows["North plant"].slice("assets", "open_work_orders") == { "assets" => 1, "open_work_orders" => 1 } && rows["South plant"]["assets"] == 1 && rows.key?("East depot"), report.inspect[0, 400]
check "…a line for what is in no site, and a total", report["shared"].slice("assets", "open_work_orders") == { "assets" => 2, "open_work_orders" => 1 } && report["total"]["assets"] == 4, report["shared"].inspect
north_report = request(:get, "/api/v1/reports/sites?from=2026-11-01&to=2026-11-30", headers: who["ADMIN"]).json
check "(a technician cannot read the report)", request(:get, "/api/v1/reports/sites", headers: who["NORTH"]).code == 403

# ── Places: who may add a site ──
child = request(:post, "/api/v1/locations", headers: who["MANAGER"], body: { location: { name: "Annex", location_type: "building", parent_id: north["id"] } })
check "a manager can add a building inside a site", child.code == 201, child.body[0, 200]
check "…but not a new site, nor change one", request(:post, "/api/v1/locations", headers: who["MANAGER"], body: { location: { name: "Rogue site", location_type: "site" } }).code == 403 && request(:patch, "/api/v1/locations/#{north['id']}", headers: who["MANAGER"], body: { location: { name: "Mine now" } }).code == 403

# ── Switch them off again ──
request(:put, "/api/v1/sites/enabled", headers: who["ADMIN"], body: { enabled: false })
check "switched off, everyone sees everything again, and nothing that was set up is lost", names.call("/api/v1/assets", "assets", "NORTH").sort == everything.sort && get.call("/api/v1/sites", "ADMIN").json["sites"].find { |s| s["id"] == north["id"] }["people"].size == 1

puts "\n#{$checks - $failures.size} of #{$checks} checks passed"
exit($failures.empty? ? 0 : 1)
