# What the code promises now (see spec/support/api_stability.rb).
module ApiStability
  module_function

  def routes(app_routes = Rails.application.routes)
    app_routes.routes.flat_map do |route|
      path = route.path.spec.to_s.delete_suffix("(.:format)")
      route.verb.to_s.split("|").reject(&:empty?).map { |verb| "#{verb} #{path}" }.select { |line| stable_route?(*line.split(" ", 2)) }
    end.uniq.sort
  end

  def resolve(node, doc)
    return node unless node.is_a?(Hash) && node["$ref"]

    node["$ref"].delete_prefix("#/").split("/").inject(doc) { |part, key| part.fetch(key) }
  end

  # Every field of a schema as "path" => {type, nullable, required, enum}; lists add "[]" to the path.
  def fields(schema, doc, prefix: "", required: false, out: {})
    schema = resolve(schema, doc)
    type = schema["type"] || (schema["properties"] ? "object" : "any")
    out[prefix] = { "type" => type, "nullable" => schema["nullable"] == true, "required" => required, "enum" => schema["enum"] }
    case type
    when "object"
      (schema["properties"] || {}).each do |name, sub|
        required_here = Array(schema["required"]).include?(name)
        fields(sub, doc, prefix: [prefix, name].reject(&:empty?).join("."), required: required_here, out: out)
      end
    when "array" then fields(schema["items"], doc, prefix: "#{prefix}[]", out: out)
    end
    out
  end

  def with_prefix(entries, label) = entries.to_h { |path, entry| ["#{label} #{path}".strip, entry] }

  # The operations of the OpenAPI document: their parameters, what they accept and what they answer.
  def operations(doc)
    doc.fetch("paths").each_with_object({}) do |(path, verbs), out|
      verbs.each do |verb, operation|
        name = "#{verb.upcase} #{path}"
        out["operation #{name}"] = { "type" => "operation" }
        operation_parts(operation, doc).each { |label, entries| out.merge!(with_prefix(entries, "#{name} #{label}")) }
      end
    end
  end

  def operation_parts(operation, doc)
    parts = {}
    (operation["parameters"] || []).each do |raw|
      param = resolve(raw, doc)
      entry = fields(param["schema"] || {}, doc).fetch("").merge("required" => param["required"] == true)
      parts["param #{param['in']} #{param['name']}"] = { "" => entry }
    end
    body = operation.dig("requestBody", "content", "application/json", "schema")
    parts["request"] = fields(body, doc).except("") if body
    (operation["responses"] || {}).each do |code, raw|
      response = resolve(raw, doc)
      parts["response #{code}"] = { "" => { "type" => "response" } }
      schema = response.dig("content", "application/json", "schema")
      parts["response #{code}"].merge!(fields(schema, doc).except("")) if schema
    end
    parts
  end

  def webhooks
    events = Webhooks::EVENTS.keys.sort
    payloads = events.map { |event| event.split(".").first }.uniq.to_h do |name|
      blueprint = "PublicApi::#{name.camelize}Blueprint".constantize
      [name, blueprint.reflections[:default].fields.keys.map(&:to_s).sort]
    end
    headers = Rails.root.join("app/services/webhook_sender.rb").read.scan(/"(X-FixFlow-[A-Za-z]+)"/).flatten.uniq.sort
    { "events" => events, "headers" => headers, "payloads" => payloads }
  end

  # The names of the settings in .env.example, set or commented out.
  def environment = Rails.root.join(".env.example").read.scan(/^#?\s*([A-Z][A-Z0-9_]+)=/).flatten.uniq.sort

  def surface(doc: PublicApiSpec.document(server: "https://fixflow.example.test/api/v1/open"), answers: {})
    { "routes" => routes, "operations" => operations(doc), "webhooks" => webhooks, "environment" => environment, "answers" => answers }
  end
end
