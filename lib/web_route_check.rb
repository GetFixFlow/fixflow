# Compares the requests the web app makes with the routes Rails has, so a screen cannot ask for an endpoint that
# does not exist (it happened 30+ times: screens that looked finished with nothing behind them).
#
# `calls` come from apps/web/scripts/list-api-calls.mjs: { verb:, path:, file:, line:, dynamic: } with the path
# relative to the API's base address and every variable written :param. `routes` are [verb, "/api/v1/..."] pairs.
class WebRouteCheck
  API_PREFIX = "/api/v1".freeze
  FORMAT_SUFFIX = /\.(csv|pdf|json)\z/

  Result = Struct.new(:matched, :missing, :dynamic, :allowed, :stale_allowances, keyword_init: true) do
    def ok? = missing.empty? && dynamic.empty? && stale_allowances.empty?
  end

  # `allowed` is a list of { "call" => "GET /path/:param", "reason" => "..." } for calls that are deliberately
  # without a route (none should be needed; each one needs a reason).
  def initialize(calls:, routes:, allowed: [])
    @calls = calls
    # A route can answer several verbs at once ("PUT|PATCH"): it counts once for each.
    @routes = routes.flat_map do |verb, path|
      next [] unless path.start_with?("#{API_PREFIX}/")

      verb.to_s.upcase.split("|").map { |single| [single, segments(path.delete_prefix(API_PREFIX))] }
    end
    @allowed = allowed.to_h { |entry| [entry.fetch("call"), entry.fetch("reason")] }
  end

  def run
    matched, unmatched = @calls.reject { |call| call[:dynamic] }.partition { |call| route_for?(call) }
    allowed_calls, missing = unmatched.partition { |call| @allowed.key?(label(call)) }
    Result.new(
      matched: matched,
      missing: missing,
      dynamic: @calls.select { |call| call[:dynamic] },
      allowed: allowed_calls,
      stale_allowances: @allowed.keys - allowed_calls.map { |call| label(call) }
    )
  end

  def label(call) = "#{call[:verb].upcase} #{call[:path]}"

  # API routes that lead nowhere: the controller does not exist, or has no such action (a request to one fails).
  # `routes` are Rails route objects.
  def self.routes_without_action(routes)
    routes.filter_map do |route|
      path = route.path.spec.to_s
      controller = route.defaults[:controller]
      next unless controller && path.start_with?("#{API_PREFIX}/")

      klass = "#{controller.camelize}Controller".safe_constantize
      next if klass&.action_methods&.include?(route.defaults[:action].to_s)

      "#{route.verb} #{path.sub('(.:format)', '')} -> #{controller}##{route.defaults[:action]}"
    end
  end

  # A route fits a call when the verb is the same and each part of the path is: the same word, or a variable in
  # the call matched by a variable in the route. (A word in the call may also fill a variable in the route, like
  # /imports/assets/template for /imports/:kind/template; a variable in the call never fills a fixed word.)
  def self.fits?(call_segments, route_segments)
    return false unless call_segments.size == route_segments.size

    call_segments.zip(route_segments).all? { |wanted, offered| wanted == offered || offered.start_with?(":") }
  end

  private

  def route_for?(call)
    wanted = segments(call[:path])
    @routes.any? { |verb, offered| verb == call[:verb].upcase && self.class.fits?(wanted, offered) }
  end

  # Every route accepts a format suffix, so /reports/work_orders/summary.csv is the route for /reports/work_orders/summary.
  def segments(path) = path.sub(/\(\.:format\)\z/, "").sub(FORMAT_SUFFIX, "").split("/").reject(&:empty?)
end
