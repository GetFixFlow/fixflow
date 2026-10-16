require "open3"

namespace :web do
  desc "Check that every request the web app makes has a route (fails if one has not)"
  task check_routes: :environment do
    require Rails.root.join("lib/web_route_check")

    script = Rails.root.join("apps/web/scripts/list-api-calls.mjs")
    output, error, status = Open3.capture3("node", script.to_s)
    abort "Could not list the web app's requests (is Node installed?):\n#{error}" unless status.success?

    calls = JSON.parse(output, symbolize_names: true)
    routes = Rails.application.routes.routes.filter_map { |route| [route.verb, route.path.spec.to_s] if route.verb.present? }
    allowlist = Rails.root.join("config/web_routes_allowlist.yml")
    allowed = allowlist.exist? ? Array(YAML.load_file(allowlist)) : []

    check = WebRouteCheck.new(calls: calls, routes: routes, allowed: allowed)
    result = check.run
    actionless = WebRouteCheck.routes_without_action(Rails.application.routes.routes)

    puts "Web app requests: #{calls.size}; with a route: #{result.matched.size}; allowed without one: #{result.allowed.size}"
    result.missing.each { |call| puts "  NO ROUTE  #{check.label(call)}  (#{call[:file]}:#{call[:line]})" }
    result.dynamic.each do |call|
      where = "#{call[:file]}:#{call[:line]}"
      puts "  PATH NOT IN THE SOURCE  #{call[:verb].upcase}  (#{where}): write the path out, or allow it with a reason"
    end
    result.stale_allowances.each { |call| puts "  ALLOWED BUT NOT FOUND  #{call}: remove it from config/web_routes_allowlist.yml" }

    actionless.each { |route| puts "  ROUTE WITH NO ACTION  #{route}" }

    abort "\nThe web app and the routes disagree." unless result.ok? && actionless.empty?
    puts "The web app and the routes agree."
  end
end
