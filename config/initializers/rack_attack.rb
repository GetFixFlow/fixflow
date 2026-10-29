class Rack::Attack
  # ── Throttles ──────────────────────────────────────────────────────────────

  # All API requests: 300 req / 5 min per IP
  throttle("api/ip", limit: 300, period: 5.minutes) do |req|
    req.ip if req.path.start_with?("/api/")
  end

  # Sign-in: 10 attempts / 1 min per IP
  throttle("api/auth/sign_in", limit: 10, period: 1.minute) do |req|
    req.ip if req.path == "/api/v1/auth/sign_in" && req.post?
  end

  # The second step of signing in: 10 tries / 1 min per IP (each person's wrong codes are also counted, and locked,
  # in the database: see TwoFactorAuth).
  throttle("api/auth/two_factor", limit: 10, period: 1.minute) do |req|
    req.ip if req.path == "/api/v1/auth/two_factor" && req.post?
  end

  # IoT ingestion: 1000 req / min per API key
  throttle("api/iot/ingest", limit: 1000, period: 1.minute) do |req|
    req.get_header("HTTP_X_API_KEY") if req.path == "/api/v1/iot/ingest"
  end

  # AI endpoints: 5 req / min per authenticated caller (LLM calls are costly).
  # Keyed by the bearer token itself (not decoded/trusted — just a cache key)
  # so distinct users behind the same IP get independent limits; falls back to
  # IP for unauthenticated requests (which will 401 anyway).
  throttle("api/ai", limit: 5, period: 1.minute) do |req|
    next unless req.path.start_with?("/api/v1/ai")

    req.get_header("HTTP_AUTHORIZATION").presence || req.ip
  end

  # Forgot password: 5 requests / min per IP, and 10 attempts / min to use a reset link.
  throttle("api/auth/password/request", limit: 5, period: 1.minute) do |req|
    req.ip if req.path == "/api/v1/auth/password" && req.post?
  end
  throttle("api/auth/password/use", limit: 10, period: 1.minute) do |req|
    req.ip if req.path == "/api/v1/auth/password" && (req.put? || req.patch?)
  end

  # Password changes: 5 attempts / min per signed-in caller (the current password is checked each time).
  throttle("api/profile/password", limit: 5, period: 1.minute) do |req|
    next unless req.path == "/api/v1/profile/password" && req.patch?

    req.get_header("HTTP_AUTHORIZATION").presence || req.ip
  end

  # Public work requests (no account, so the address is all there is to go on). A few reports an hour is
  # normal; the overall cap keeps a spread-out flood from filling the managers' inboxes, at the price that
  # a flood can also stop real reports for a while.
  throttle("api/work_requests/create/ip", limit: 5, period: 10.minutes) do |req|
    req.ip if req.path == "/api/v1/work_requests" && req.post?
  end
  throttle("api/work_requests/create/day", limit: 20, period: 1.day) do |req|
    req.ip if req.path == "/api/v1/work_requests" && req.post?
  end
  throttle("api/work_requests/create/all", limit: 60, period: 1.hour) do |req|
    "all" if req.path == "/api/v1/work_requests" && req.post?
  end
  # Looking a link or an asset code up: far more than a person would, and it is guessing.
  throttle("api/work_requests/lookup/ip", limit: 60, period: 5.minutes) do |req|
    req.ip if req.get? && (req.path.start_with?("/api/v1/work_requests/") || req.path.start_with?("/api/v1/public_assets/"))
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
