# What FixFlow 1.x promises not to break (docs/stability.md), written down as data and compared with what the code does now.
#
# The promise covers the parts a company's own programs depend on: the public API (`/api/v1/open`, described in
# config/public_api.openapi.yml), sensor ingestion, webhooks, the health check and the settings in `.env`. It does not cover
# the rest of the API, which is the web app's own and changes with it (docs/api-endpoints.md says which is which).
#
# `spec/contracts/api_1_0_baseline.json` is what was promised. A change is a **break** when it takes something away or turns
# it into something else: a route, a field of a request or an answer, a type, a choice a request may send, a webhook event,
# a setting. Adding is not a break: a new field, route, event or setting, an optional parameter. `breaks` lists the breaks
# between the baseline and the code as it is; the spec fails when there are any.
require "fixflow_api_docs"

module ApiStability
  BASELINE = Rails.root.join("spec/contracts/api_1_0_baseline.json")

  module_function

  def stable_route?(verb, path) = FixflowApiDocs.stable?(verb, path)

  # ── What an answer looks like ─────────────────────────────────────────────────────────────────────────────────────

  def kind(value)
    case value
    when Hash then "object"
    when Array then "array"
    when String then "string"
    when Integer, Float, BigDecimal then "number"
    when true, false then "boolean"
    else "null"
    end
  end

  # "path" => kind, for every field of a JSON answer. The rows of a list are read as one, and a null never hides a real kind
  # (a field that is empty in one row and a number in the next is a number).
  def shape(value, prefix = "", out = {})
    out[prefix] = kind(value) if prefix != "" && (out[prefix].nil? || out[prefix] == "null")
    case value
    when Hash then value.each { |name, inner| shape(inner, [prefix, name].reject(&:empty?).join("."), out) }
    when Array then value.each { |inner| shape(inner, "#{prefix}[]", out) }
    end
    out
  end

  # ── The file ────────────────────────────────────────────────────────────────────────────────────────────────────────

  def baseline = JSON.parse(BASELINE.read)

  # One line for each route, field and answer, so a change to the baseline shows in a review as exactly what changed.
  def render(value, depth: 0, deepest: 2)
    return JSON.generate(value) if depth >= deepest || !value.respond_to?(:each)

    pad = "  " * (depth + 1)
    inner = lines(value, pad, depth, deepest)
    open, close = value.is_a?(Hash) ? %w[{ }] : %w[[ ]]
    "#{open}\n#{inner.join(",\n")}\n#{'  ' * depth}#{close}"
  end

  def lines(value, pad, depth, deepest)
    return value.map { |item| "#{pad}#{render(item, depth: depth + 1, deepest: deepest)}" } unless value.is_a?(Hash)

    value.map { |key, item| "#{pad}#{JSON.generate(key)}: #{render(item, depth: depth + 1, deepest: deepest)}" }
  end

  def render_baseline(current)
    sections = current.map { |name, data| "  #{JSON.generate(name)}: #{render(data, depth: 1, deepest: name == 'answers' ? 3 : 2)}" }
    "{\n#{sections.join(",\n")}\n}\n"
  end

  # Writes the baseline. Refuses when what is written would hide a break: only additions may be accepted this way.
  def write_baseline(current)
    if BASELINE.exist?
      problems = breaks(baseline, current)
      raise "Not updating the baseline, this breaks the 1.x promise:\n  #{problems.join("\n  ")}" if problems.any?
    end
    BASELINE.write(render_baseline(current))
  end
end
