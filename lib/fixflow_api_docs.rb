# The list of API endpoints in docs/api-endpoints.md, written from the routes so it cannot fall behind them. The page is
# made by `rails docs:api`; spec/config/docs_spec.rb fails when the file differs from what this makes.
module FixflowApiDocs
  PREFIX = "/api/v1/".freeze

  Endpoint = Struct.new(:verbs, :path, :action)

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
  MD

  def self.anchor(name) = name.tr("_", "-")

  def self.markdown(routes = Rails.application.routes)
    groups = endpoints(routes)
    links = groups.keys.map { |name| "[#{name}](##{anchor(name)})" }
    lines = [INTRO, "There are #{groups.values.sum(&:size)} endpoints in #{groups.size} groups: #{links.join(', ')}.", ""]
    groups.each do |name, endpoints|
      lines += ["## #{anchor(name)}", "", "| Method | Path | Handled by |", "| --- | --- | --- |"]
      endpoints.sort_by { |e| [e.path, e.verbs] }.each do |endpoint|
        lines << "| #{endpoint.verbs} | `#{endpoint.path}` | `#{endpoint.action}` |"
      end
      lines << ""
    end
    "#{lines.join("\n").rstrip}\n"
  end
end
