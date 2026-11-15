class Rack::Attack
  # The address as the router reads it. A route answers /api/v1/auth/sign_in.json, /api/v1/auth/sign_in/ and
  # //api/v1/auth/sign_in as it does /api/v1/auth/sign_in, so a limit that compared the raw path would not apply to them.
  def self.route_path(req)
    req.path.squeeze("/").sub(/\.\w+\z/, "").chomp("/")
  end

  # What a caller's limit is counted against: their token (the first word after "Bearer", as the sign-in library reads
  # it: "Bearer <token> anything" is the same token), or their address when there is none. Not the whole header, which
  # a caller could make different on every request without changing who they are.
  def self.caller_key(req)
    req.get_header("HTTP_AUTHORIZATION").to_s.split[1].presence || req.ip
  end

  # ── Throttles ──────────────────────────────────────────────────────────────

  # All API requests: 300 req / 5 min per IP
  throttle("api/ip", limit: 300, period: 5.minutes) do |req|
    req.ip if Rack::Attack.route_path(req).start_with?("/api/") && !Rack::Attack.route_path(req).start_with?("/api/v1/open/")
  end

  # The public API (programs with an API key): 600 requests / min for each key, and 1200 / min for each address (which
  # also bounds guessing keys). A program polling every few seconds, or several started together, stay well inside.
  throttle("api/open/key", limit: 600, period: 1.minute) do |req|
    if Rack::Attack.route_path(req).start_with?("/api/v1/open/")
      key = req.get_header("HTTP_X_API_KEY").presence || req.get_header("HTTP_AUTHORIZATION").to_s[/\ABearer\s+(fxk_\S+)/i, 1]
      ApiKey.hint_for(key) if key.present?
    end
  end

  throttle("api/open/ip", limit: 1200, period: 1.minute) do |req|
    req.ip if Rack::Attack.route_path(req).start_with?("/api/v1/open/")
  end

  # Sign-in: 10 attempts / 1 min per IP
  throttle("api/auth/sign_in", limit: 10, period: 1.minute) do |req|
    req.ip if Rack::Attack.route_path(req) == "/api/v1/auth/sign_in" && req.post?
  end

  # The second step of signing in: 10 tries / 1 min per IP (each person's wrong codes are also counted, and locked,
  # in the database: see TwoFactorAuth).
  throttle("api/auth/two_factor", limit: 10, period: 1.minute) do |req|
    req.ip if Rack::Attack.route_path(req) == "/api/v1/auth/two_factor" && req.post?
  end

  # Signing in through the company's identity provider: 60 starts or returns / 1 min per IP (a shift starting behind one
  # office address signs in together), and the last step 30 / min. Each is a sign-in the identity provider has already
  # asked for a password and its own checks for.
  throttle("api/auth/oidc", limit: 60, period: 1.minute) do |req|
    req.ip if Rack::Attack.route_path(req).start_with?("/api/v1/auth/oidc/") && req.get?
  end

  throttle("api/auth/directory", limit: 30, period: 1.minute) do |req|
    req.ip if Rack::Attack.route_path(req) == "/api/v1/auth/directory" && req.post?
  end

  # IoT ingestion: 1000 req / min per API key
  throttle("api/iot/ingest", limit: 1000, period: 1.minute) do |req|
    key = req.get_header("HTTP_X_API_KEY").presence
    ApiKey.hint_for(key) if key && Rack::Attack.route_path(req) == "/api/v1/iot/ingest" # not the key itself: it would sit in Redis
  end

  # AI endpoints: 5 req / min per authenticated caller (LLM calls are costly).
  # Keyed by the bearer token itself (not decoded/trusted — just a cache key)
  # so distinct users behind the same IP get independent limits; falls back to
  # IP for unauthenticated requests (which will 401 anyway).
  throttle("api/ai", limit: 5, period: 1.minute) do |req|
    # What costs a model call: the assistant, a suggested priority, a draft work order, and the AI settings' "try it" button.
    # Asking whether AI is on,
    # and reading and saving the settings, cost nothing.
    paths = %w[/api/v1/ai/assist /api/v1/ai/priority /api/v1/ai/work_order_draft /api/v1/ai_settings/test]
    next unless paths.include?(Rack::Attack.route_path(req))

    Rack::Attack.caller_key(req)
  end

  # Forgot password: 5 requests / min per IP, and 10 attempts / min to use a reset link.
  throttle("api/auth/password/request", limit: 5, period: 1.minute) do |req|
    req.ip if Rack::Attack.route_path(req) == "/api/v1/auth/password" && req.post?
  end
  throttle("api/auth/password/use", limit: 10, period: 1.minute) do |req|
    req.ip if Rack::Attack.route_path(req) == "/api/v1/auth/password" && (req.put? || req.patch?)
  end

  # Password changes: 5 attempts / min per signed-in caller (the current password is checked each time).
  throttle("api/profile/password", limit: 5, period: 1.minute) do |req|
    next unless Rack::Attack.route_path(req) == "/api/v1/profile/password" && req.patch?

    Rack::Attack.caller_key(req)
  end

  # Public work requests (no account, so the address is all there is to go on). A few reports an hour is
  # normal; the overall cap keeps a spread-out flood from filling the managers' inboxes, at the price that
  # a flood can also stop real reports for a while.
  throttle("api/work_requests/create/ip", limit: 5, period: 10.minutes) do |req|
    req.ip if Rack::Attack.route_path(req) == "/api/v1/work_requests" && req.post?
  end
  throttle("api/work_requests/create/day", limit: 20, period: 1.day) do |req|
    req.ip if Rack::Attack.route_path(req) == "/api/v1/work_requests" && req.post?
  end
  throttle("api/work_requests/create/all", limit: 60, period: 1.hour) do |req|
    "all" if Rack::Attack.route_path(req) == "/api/v1/work_requests" && req.post?
  end
  # Looking a link or an asset code up: far more than a person would, and it is guessing.
  throttle("api/work_requests/lookup/ip", limit: 60, period: 5.minutes) do |req|
    path = Rack::Attack.route_path(req)
    req.ip if req.get? && (path.start_with?("/api/v1/work_requests/") || path.start_with?("/api/v1/public_assets/"))
  end

  # ── Blocklist ──────────────────────────────────────────────────────────────

  blocklist("block bad ips") do |req|
    blocked = ENV.fetch("BLOCKED_IPS", "").split(",").map(&:strip)
    blocked.include?(req.ip)
  end

  # ── Response ───────────────────────────────────────────────────────────────

  self.throttled_responder = lambda do |req|
    match_data = req.env["rack.attack.match_data"] || {}
    retry_after = match_data[:period].to_i

    [
      429,
      {
        "Content-Type"  => "application/json",
        "Retry-After"   => retry_after.to_s
      },
      [{
        success:     false,
        error: {
          code:        "RATE_LIMITED",
          message:     "Too many requests. Please try again later.",
          retry_after: retry_after
        }
      }.to_json]
    ]
  end

  self.blocklisted_responder = lambda do |_req|
    [403, { "Content-Type" => "application/json" },
     [{ success: false, error: { code: "FORBIDDEN", message: "Access denied." } }.to_json]]
  end
end

# Use Redis as cache store in production; in-memory otherwise
if Rails.env.production?
  Rack::Attack.cache.store = ActiveSupport::Cache::RedisCacheStore.new(
    url: ENV.fetch("REDIS_URL", "redis://localhost:6379/1")
  )
end
