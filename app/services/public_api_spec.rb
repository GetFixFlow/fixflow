# The public API (/api/v1/open) described as an OpenAPI 3 document, so tools can read it: n8n and Zapier can import it,
# Postman and code generators can be pointed at it. The document itself is config/public_api.openapi.yml, kept by hand next
# to the controllers; spec/services/public_api_spec_spec.rb fails when a route is added there and not in the document, or
# described and not routed, or when a field of an answer is missing from its description.
module PublicApiSpec
  FILE = Rails.root.join("config/public_api.openapi.yml")

  def self.document(server:)
    YAML.safe_load_file(FILE).merge("servers" => [{ "url" => server }])
  end
end
