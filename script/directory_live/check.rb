# Signs in through a real Keycloak (OpenID Connect) and a real OpenLDAP the way a browser and the web app do, against a
# running FixFlow API, and prints one line per check. Run by script/directory_live/run, which starts all three.
#
#   ruby script/directory_live/check.rb          (needs API=http://localhost:3077 KEYCLOAK=http://localhost:8089)
require "net/http"
require "json"
require "uri"
require "cgi"
require "base64"
require "openssl"

API = ENV.fetch("API", "http://localhost:3077")
KEYCLOAK = ENV.fetch("KEYCLOAK", "http://localhost:8089")
LDAP_HOST = ENV.fetch("LDAP_HOST", "localhost")
LDAP_PORT = Integer(ENV.fetch("LDAP_PORT", "3389"))
LDAP_CA = File.read(ENV["LDAP_CA"]) if ENV["LDAP_CA"] && File.exist?(ENV["LDAP_CA"])
ISSUER = "#{KEYCLOAK}/realms/acme"

$failures = []
$checks = 0

# Password sign-in is limited to 10 a minute for each address (config/initializers/rack_attack.rb): wait for a fresh minute.
def breathe(why)
  puts "   (waiting a minute for the sign-in limit: #{why})"
  sleep 62
end

def check(name, ok, detail = nil)
  $checks += 1
  puts "#{ok ? 'PASS' : 'FAIL'}  #{name}#{detail && !ok ? "  -> #{detail}" : ''}"
  $failures << name unless ok
end

# A browser, as far as these flows need one: cookies kept per host, redirects followed only when asked.
class Browser
  Response = Struct.new(:code, :headers, :body) do
    def location = headers["location"]
    def json = JSON.parse(body)
  end

  def initialize = @jar = Hash.new { |h, k| h[k] = {} }

  def get(url, headers: {}) = request(Net::HTTP::Get, url, nil, headers)

  def post_form(url, form, headers: {}) = request(Net::HTTP::Post, url, URI.encode_www_form(form), headers.merge("Content-Type" => "application/x-www-form-urlencoded"))

  def post_json(url, body, headers: {}) = request(Net::HTTP::Post, url, JSON.generate(body), headers.merge("Content-Type" => "application/json"))

  def patch_json(url, body, headers: {}) = request(Net::HTTP::Patch, url, JSON.generate(body), headers.merge("Content-Type" => "application/json"))

  def delete(url, headers: {}) = request(Net::HTTP::Delete, url, nil, headers)

  private

  def request(klass, url, body, headers)
    uri = URI(url)
    req = klass.new(uri)
    headers.each { |k, v| req[k] = v }
    jar = @jar["#{uri.host}:#{uri.port}"]
    req["Cookie"] = jar.map { |k, v| "#{k}=#{v}" }.join("; ") unless jar.empty?
    req.body = body if body
    res = Net::HTTP.start(uri.host, uri.port, read_timeout: 30) { |http| http.request(req) }
    Array(res.get_fields("set-cookie")).each do |c|
      name, value = c.split(";").first.split("=", 2)
      value.to_s.empty? || c =~ /expires=Thu, 01 Jan 1970/i ? jar.delete(name) : jar[name] = value
    end
    Response.new(res.code.to_i, res.each_header.to_h, res.body.to_s)
  end
end

def query_of(url) = URI.decode_www_form(URI(url).query.to_s).to_h

# ── Signing in at Keycloak and coming back, the way a browser does ──
def keycloak_sign_in(username, password)
  browser = Browser.new
  start = browser.get("#{API}/api/v1/auth/oidc/start")
  return [ browser, nil, "start gave #{start.code}" ] unless start.code == 302 && start.location.to_s.start_with?(ISSUER)

  page = browser.get(start.location)
  form = page.body[/<form[^>]*id="kc-form-login"[^>]*action="([^"]+)"/, 1] || page.body[/<form[^>]*action="([^"]+)"[^>]*id="kc-form-login"/, 1]
  return [ browser, nil, "no login form (#{page.code})" ] unless form

  login = browser.post_form(CGI.unescapeHTML(form), { "username" => username, "password" => password, "credentialId" => "" })
  return [ browser, nil, "keycloak refused the sign-in (#{login.code})" ] unless login.code == 302 && login.location.to_s.include?("/api/v1/auth/oidc/callback")

  [ browser, login.location, nil ]
end

def finish_oidc(browser, callback_url)
  back = browser.get(callback_url)
  return [ nil, back ] unless back.code == 302

  [ back.location, back ]
end

def swap_note(location)
  note = query_of(location)["code"]
  res = Browser.new.post_json("#{API}/api/v1/auth/directory", { code: note })
  [ res, note ]
end

def me(token) = Browser.new.get("#{API}/api/v1/auth/me", headers: { "Authorization" => token }).json

def oidc_sign_in(username, password)
  browser, callback, problem = keycloak_sign_in(username, password)
  return { problem: problem } unless callback

  location, = finish_oidc(browser, callback)
  return { problem: "callback did not redirect" } unless location
  return { error: query_of(location)["directory_error"], browser: browser, callback: callback } unless location.include?("/login/directory")

  res, note = swap_note(location)
  { res: res, note: note, token: res.headers["authorization"], browser: browser, callback: callback, location: location }
end

# ── The company's administrator sets it up through the real settings API ──
admin = Browser.new
signin = admin.post_json("#{API}/api/v1/auth/sign_in", { user: { email: "admin@acme.test", password: "Ledger-pass-2026-xyz" } })
check "the local administrator signs in with a password", signin.code == 200, signin.body[0, 200]
auth = { "Authorization" => signin.headers["authorization"] }

settings = {
  oidc_enabled: true, oidc_label: "Acme Keycloak", oidc_issuer: ISSUER, oidc_client_id: "fixflow", oidc_client_secret: "fixflow-client-secret",
  ldap_enabled: true, ldap_host: LDAP_HOST, ldap_port: LDAP_PORT, ldap_encryption: "none", ldap_bind_dn: "cn=fixflow,ou=services,dc=acme,dc=test",
  ldap_bind_password: "fixflow-service-pass", ldap_user_base: "ou=people,dc=acme,dc=test", ldap_user_filter: "(objectClass=inetOrgPerson)",
  ldap_login_attributes: "uid,mail", ldap_groups_attribute: "memberOf",
  role_groups: { admin: "fixflow-admins", manager: "fixflow-managers", technician: "fixflow-technicians" }, sync_roles: true, create_people: true
}
saved = admin.patch_json("#{API}/api/v1/directory_settings", { settings: settings }, headers: auth)
check "the settings save", saved.code == 200, saved.body[0, 300]
check "the secrets are not sent back", !saved.body.include?("fixflow-client-secret") && !saved.body.include?("fixflow-service-pass")
check "the redirect address to register is shown", saved.json["callback_url"] == "#{API}/api/v1/auth/oidc/callback", saved.json["callback_url"]

public_view = Browser.new.get("#{API}/api/v1/auth/directory").json
check "the sign-in screen is offered both ways", public_view.dig("oidc", "enabled") && public_view.dig("ldap", "enabled") && public_view.dig("oidc", "label") == "Acme Keycloak", public_view.inspect

oidc_check = admin.post_json("#{API}/api/v1/directory_settings/test", { kind: "oidc", settings: {} }, headers: auth)
check "Check finds Keycloak and its keys", oidc_check.code == 200 && oidc_check.json["keys"].to_i >= 1 && oidc_check.json["issuer"] == ISSUER, oidc_check.body[0, 300]
wrong = admin.post_json("#{API}/api/v1/directory_settings/test", { kind: "oidc", settings: { oidc_issuer: "#{KEYCLOAK}/realms/nope" } }, headers: auth)
check "Check says in words when the realm is wrong", wrong.code == 422 && wrong.json.dig("error", "message").to_s.include?("404"), wrong.body[0, 300]

ldap_check = admin.post_json("#{API}/api/v1/directory_settings/test", { kind: "ldap", settings: {}, login: "alice", password: "alice-pass" }, headers: auth)
person = ldap_check.json["person"] || {}
check "Check finds OpenLDAP and the people", ldap_check.code == 200 && ldap_check.json["people_found"].to_i >= 5, ldap_check.body[0, 300]
check "Try a person shows alice with her groups and the admin role", person["found"] && person["role"] == "admin" && person["email"] == "alice@acme.test", person.inspect
bad_service = admin.post_json("#{API}/api/v1/directory_settings/test", { kind: "ldap", settings: { ldap_bind_password: "wrong" }, login: "alice", password: "alice-pass" }, headers: auth)
check "Check says the service account is wrong", bad_service.code == 422 && bad_service.json.dig("error", "message").to_s.include?("service account"), bad_service.body[0, 300]

# ── OpenID Connect with Keycloak ──
puts "-- OpenID Connect (Keycloak)"
roles = { "alice" => "admin", "bob" => "manager", "carol" => "technician" }
roles.each do |name, role|
  r = oidc_sign_in(name, "#{name}-pass")
  ok = r[:res] && r[:res].code == 200 && r[:token].to_s.start_with?("Bearer ")
  check "#{name} signs in through Keycloak", ok, r.inspect[0, 300]
  next unless ok

  user = me(r[:token])
  check "#{name} has the role of their group (#{role})", user["role"] == role, user.inspect[0, 200]
  check "#{name}'s name and email come from Keycloak", user["email"] == "#{name}@acme.test" && user["first_name"] == name.capitalize, user.inspect[0, 200]
  again = Browser.new.post_json("#{API}/api/v1/auth/directory", { code: r[:note] })
  check "#{name}'s note works only once", again.code == 401
  replay = r[:browser].get(r[:callback])
  check "#{name}'s return from Keycloak cannot be replayed", replay.code == 302 && replay.location.to_s.include?("directory_error=failed"), replay.location
end

nogroup = oidc_sign_in("dave", "dave-pass")
check "dave (in no group) is turned away with the right words", nogroup[:error] == "not_allowed", nogroup.inspect[0, 200]
check "dave got no account", admin.get("#{API}/api/v1/users", headers: auth).json["users"].none? { |u| u["email"] == "dave@acme.test" }

wrong_pass = keycloak_sign_in("alice", "not-her-password")
check "a wrong password is refused by Keycloak, and never reaches FixFlow", wrong_pass[1].nil?, wrong_pass.inspect[0, 200]

tamper_browser, tamper_callback, = keycloak_sign_in("carol", "carol-pass")
tampered = tamper_callback.sub(/state=[^&]+/, "state=forged")
back = tamper_browser.get(tampered)
check "a changed state is refused", back.code == 302 && back.location.to_s.include?("directory_error=failed"), back.location
nocookie = Browser.new.get(tamper_callback)
check "a return from Keycloak with no cookie from this browser is refused (a link someone else made)", nocookie.code == 302 && nocookie.location.to_s.include?("directory_error=failed"), nocookie.location

erin = oidc_sign_in("erin", "erin-pass")
check "erin signs in (an address Keycloak says is unverified, no account yet)", erin[:res] && erin[:res].code == 200, erin.inspect[0, 200]

# ── The role follows the groups: move carol in Keycloak, sign in again ──
kc_admin = Browser.new
token = kc_admin.post_form("#{KEYCLOAK}/realms/master/protocol/openid-connect/token",
                           { "grant_type" => "password", "client_id" => "admin-cli", "username" => "admin", "password" => "admin" }).json["access_token"]
kc = { "Authorization" => "Bearer #{token}" }
carol_id = kc_admin.get("#{KEYCLOAK}/admin/realms/acme/users?username=carol&exact=true", headers: kc).json.first["id"]
groups = kc_admin.get("#{KEYCLOAK}/admin/realms/acme/groups", headers: kc).json.to_h { |g| [ g["name"], g["id"] ] }
put = lambda do |path|
  uri = URI("#{KEYCLOAK}#{path}")
  Net::HTTP.start(uri.host, uri.port) { |h| r = Net::HTTP::Put.new(uri); r["Authorization"] = "Bearer #{token}"; h.request(r) }
end
del = lambda do |path|
  uri = URI("#{KEYCLOAK}#{path}")
  Net::HTTP.start(uri.host, uri.port) { |h| r = Net::HTTP::Delete.new(uri); r["Authorization"] = "Bearer #{token}"; h.request(r) }
end
put.call("/admin/realms/acme/users/#{carol_id}/groups/#{groups['fixflow-managers']}")
promoted = oidc_sign_in("carol", "carol-pass")
check "carol, put in the managers group at Keycloak, is a manager at her next sign-in", promoted[:token] && me(promoted[:token])["role"] == "manager"
del.call("/admin/realms/acme/users/#{carol_id}/groups/#{groups['fixflow-managers']}")
del.call("/admin/realms/acme/users/#{carol_id}/groups/#{groups['fixflow-technicians']}")
removed = oidc_sign_in("carol", "carol-pass")
check "carol, removed from every group, is turned away at her next sign-in", removed[:error] == "not_allowed", removed.inspect[0, 200]
check "carol's account is kept, with the role she had", admin.get("#{API}/api/v1/users", headers: auth).json["users"].find { |u| u["email"] == "carol@acme.test" }&.dig("role") == "manager"
put.call("/admin/realms/acme/users/#{carol_id}/groups/#{groups['fixflow-technicians']}")

# ── LDAP with OpenLDAP ──
puts "-- LDAP (OpenLDAP)"
breathe("before the LDAP sign-ins")
# the same people exist in both directories: the ones who signed in through OpenID are not silently taken over by LDAP
clash = Browser.new.post_json("#{API}/api/v1/auth/sign_in", { user: { email: "alice", password: "alice-pass" } })
check "alice, who signs in through OpenID Connect, is not taken over by LDAP", clash.code == 403 && clash.json["code"] == "DIRECTORY_ACCOUNT_CONFLICT", clash.body[0, 200]
ldap_sign_in = lambda do |login, password|
  Browser.new.post_json("#{API}/api/v1/auth/sign_in", { user: { email: login, password: password } })
end
r = ldap_sign_in.call("lena", "lena-pass")
check "lena signs in with her username (memberOf gives admin)", r.code == 200 && r.json.dig("user", "role") == "admin" && r.json.dig("user", "identity_provider") == "ldap", r.body[0, 300]
r2 = ldap_sign_in.call("mark@acme.test", "mark-pass")
check "mark signs in with his email address (manager)", r2.code == 200 && r2.json.dig("user", "role") == "manager", r2.body[0, 300]
check "the session works for the API", Browser.new.get("#{API}/api/v1/auth/me", headers: { "Authorization" => r2.headers["authorization"] }).code == 200
bad = ldap_sign_in.call("alice", "wrong")
check "a wrong password is 401", bad.code == 401, bad.body[0, 200]
blank = ldap_sign_in.call("alice", "")
check "a blank password is refused (no anonymous bind)", blank.code == 401, blank.body[0, 200]
nogrp = ldap_sign_in.call("dave", "dave-pass")
check "dave, in no group, is turned away with words", nogrp.code == 403 && nogrp.json.dig("code") == "DIRECTORY_NOT_ALLOWED", nogrp.body[0, 200]
star = ldap_sign_in.call("*", "alice-pass")
check "a login of * finds no one", star.code == 401, star.body[0, 200]
inj = ldap_sign_in.call("*)(uid=*", "alice-pass")
check "a login that tries to widen the search finds no one", inj.code == 401, inj.body[0, 200]
twin = ldap_sign_in.call("frank", "frank-pass")
check "a login two people share is no one's", twin.code == 401, twin.body[0, 200]
breathe("half way through the LDAP sign-ins")
none = ldap_sign_in.call("nobody", "x")
check "an unknown person is 401, the same as a wrong password", none.code == 401 && none.body == bad.body, none.body[0, 200]

# the company's own administrator still signs in with a password: the way back in
again = Browser.new.post_json("#{API}/api/v1/auth/sign_in", { user: { email: "admin@acme.test", password: "Ledger-pass-2026-xyz" } })
check "the local administrator still signs in with a password while LDAP is on", again.code == 200 && again.json.dig("user", "role") == "admin", again.body[0, 200]

breathe("before the directory-down check")
# the directory down, and certificates
off = admin.patch_json("#{API}/api/v1/directory_settings", { settings: { ldap_host: LDAP_HOST, ldap_port: 1 } }, headers: auth)
down = ldap_sign_in.call("alice", "alice-pass")
check "the directory being down is 503 with words, not a stack trace", down.code == 503 && down.json["code"] == "DIRECTORY_UNREACHABLE" && !down.body.include?("Errno"), down.body[0, 200]
admin.patch_json("#{API}/api/v1/directory_settings", { settings: { ldap_host: LDAP_HOST, ldap_port: LDAP_PORT } }, headers: auth)

tls_verified = admin.post_json("#{API}/api/v1/directory_settings/test", { kind: "ldap", settings: { ldap_encryption: "starttls", ldap_verify_certificate: true, ldap_ca_certificate: "" }, login: "alice", password: "alice-pass" }, headers: auth)
check "STARTTLS with the certificate checked refuses a certificate it does not trust", tls_verified.code == 422 && tls_verified.json.dig("error", "message").to_s =~ /certificate|SSL|verify/i, tls_verified.body[0, 300]
tls_open = admin.post_json("#{API}/api/v1/directory_settings/test", { kind: "ldap", settings: { ldap_encryption: "starttls", ldap_verify_certificate: false }, login: "alice", password: "alice-pass" }, headers: auth)
check "STARTTLS with the check switched off works", tls_open.code == 200 && tls_open.json.dig("person", "found"), tls_open.body[0, 300]
if LDAP_CA
  tls_ca = admin.post_json("#{API}/api/v1/directory_settings/test", { kind: "ldap", settings: { ldap_encryption: "starttls", ldap_verify_certificate: true, ldap_ca_certificate: LDAP_CA }, login: "alice", password: "alice-pass" }, headers: auth)
  check "STARTTLS with the company's own CA certificate pasted in works", tls_ca.code == 200 && tls_ca.json.dig("person", "found"), tls_ca.body[0, 300]
end

# ── The audit log ──
lines = (1..6).flat_map { |page| Array(admin.get("#{API}/api/v1/activity_logs?page=#{page}", headers: auth).json["activity_logs"]) }
actions = lines.map { |l| l["action"] }.tally
check "the audit log records the directory events", %w[directory.person_created directory.role_changed directory.sign_in_refused directory_settings.updated].all? { |a| actions.key?(a) }, actions.inspect

puts
puts "#{$checks - $failures.size} of #{$checks} checks passed"
puts "FAILED: #{$failures.join('; ')}" if $failures.any?
exit($failures.empty? ? 0 : 1)
