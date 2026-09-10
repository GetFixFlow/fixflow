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
