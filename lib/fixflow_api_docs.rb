# The list of API endpoints in docs/api-endpoints.md, written from the routes so it cannot fall behind them. The page is
# made by `rails docs:api`; spec/config/docs_spec.rb fails when the file differs from what this makes.
module FixflowApiDocs
  PREFIX = "/api/v1/".freeze

  Endpoint = Struct.new(:verbs, :path, :action)

  # What FixFlow 1.x promises not to break (docs/stability.md): the public API, sensor ingestion and the health check. Every
  # other endpoint is the web app's own, and changes with it. spec/contracts/stable_api_spec.rb holds the promise to this list.
  STABLE_PREFIX = "/api/v1/open/".freeze
  STABLE_ROUTES = ["POST /api/v1/iot/ingest", "GET /api/v1/health"].freeze

  def self.stable?(verbs, path)
    return true if path.start_with?(STABLE_PREFIX)

    STABLE_ROUTES.any? do |route|
      verb, stable_path = route.split(" ", 2)
      stable_path == path && Array(verbs).flat_map { |v| v.to_s.split(/[,|]\s*/) }.include?(verb)
    end
  end

  # The endpoints of the API (and the live-updates WebSocket), grouped by the first part of their address.
  def self.endpoints(routes = Rails.application.routes)
    all = routes.routes.filter_map do |route|
      path = route.path.spec.to_s.delete_suffix("(.:format)")
      next unless path.start_with?(PREFIX)

      Endpoint.new(route.verb.to_s, path, "#{route.defaults[:controller]}##{route.defaults[:action]}")
    end
    merged = all.group_by { |endpoint| [endpoint.path, endpoint.action] }.map do |(path, action), same|
      verbs = same.flat_map { |endpoint| endpoint.verbs.split("|") }.reject(&:empty?).uniq.sort
      Endpoint.new(verbs.join(", "), path, action)
    end
    merged.group_by { |endpoint| endpoint.path.delete_prefix(PREFIX).split("/").first }.sort.to_h
  end

  INTRO = <<~MD.freeze
    # API endpoints

    Every endpoint of the API, written from the server's routes by `rails docs:api` (do not edit this page by hand).
    How to sign in, what answers look like and what the limits are is on the [API](api.md) page. In the paths, `:id` and
    the like stand for a value, and `:format` is left out. Live updates are a WebSocket at `/cable`. The `auth` group also
    holds the standard routes of the sign-in library that nothing uses (`sign_up/edit` and the like): the ones to use are
    `sign_in`, `sign_out`, `two_factor`, `password` and `me`; `sign_up` works only until the first company exists.

    The **Stability** column says what [version 1.0 promises](stability.md): **Stable** endpoints (the public API under
    `/api/v1/open`, sensor ingestion and the health check) do not change within 1.x except by adding to them. **Web app**
    endpoints are the web app's own: they change together with it, and the changelog says when they do, but a program
    should not depend on them.
  MD

  def self.anchor(name) = name.tr("_", "-")

  def self.markdown(routes = Rails.application.routes)
    groups = endpoints(routes)
    links = groups.keys.map { |name| "[#{name}](##{anchor(name)})" }
    total = groups.values.sum(&:size)
    stable = groups.values.flatten.count { |endpoint| stable?(endpoint.verbs, endpoint.path) }
    lines = [INTRO, "There are #{total} endpoints in #{groups.size} groups, #{stable} of them stable: #{links.join(', ')}.", ""]
    groups.each do |name, endpoints|
      lines += ["## #{anchor(name)}", "", "| Method | Path | Handled by | Stability |", "| --- | --- | --- | --- |"]
      endpoints.sort_by { |e| [e.path, e.verbs] }.each do |endpoint|
        label = stable?(endpoint.verbs, endpoint.path) ? "**Stable**" : "Web app"
        lines << "| #{endpoint.verbs} | `#{endpoint.path}` | `#{endpoint.action}` | #{label} |"
      end
      lines << ""
    end
    "#{lines.join("\n").rstrip}\n"
  end
end
