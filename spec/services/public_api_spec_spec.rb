require "rails_helper"

# The OpenAPI document of the public API must describe every route of it, and nothing that is not routed.
RSpec.describe PublicApiSpec do
  let(:document) { described_class.document(server: "https://fixflow.example.test/api/v1/open") }

  def routed
    Rails.application.routes.routes.filter_map do |route|
      path = route.path.spec.to_s.sub("(.:format)", "")
      next unless path.start_with?("/api/v1/open/") && route.verb != "PUT"

      [route.verb.downcase, path.delete_prefix("/api/v1/open").gsub(/:(\w+)/, '{\1}')]
    end
  end

  def described = document["paths"].flat_map { |path, methods| methods.keys.map { |verb| [verb, path] } }

  it "describes every route of the public API" do
    expect(described).to match_array(routed)
  end

  it "is OpenAPI 3 with the two ways of sending a key, and a server" do
    expect(document).to include("openapi" => "3.0.3")
    expect(document["servers"]).to eq([{ "url" => "https://fixflow.example.test/api/v1/open" }])
    expect(document.dig("components", "securitySchemes").keys).to contain_exactly("bearerAuth", "apiKeyAuth")
  end

  it "points every reference at something that exists" do
    refs = document.to_json.scan(%r{"\$ref":"#/components/(\w+)/(\w+)"})
    expect(refs).not_to be_empty
    refs.each { |kind, name| expect(document.dig("components", kind)).to have_key(name), "#{kind}/#{name}" }
  end

  it "names the fields the blueprints send" do
    org = create(:organization)
    work_order = PublicApi::WorkOrderBlueprint.render_as_hash(create(:work_order, organization: org,
assignee: create(:user, organization: org)))
    expect(document.dig("components", "schemas", "WorkOrder", "properties").keys).to match_array(work_order.keys.map(&:to_s))
    asset = PublicApi::AssetBlueprint.render_as_hash(create(:asset, organization: org))
    expect(document.dig("components", "schemas", "Asset", "properties").keys).to match_array(asset.keys.map(&:to_s))
    part = PublicApi::PartBlueprint.render_as_hash(create(:part, organization: org))
    expect(document.dig("components", "schemas", "Part", "properties").keys).to match_array(part.keys.map(&:to_s))
    location = PublicApi::LocationBlueprint.render_as_hash(create(:location, organization: org))
    expect(document.dig("components", "schemas", "Location", "properties").keys).to match_array(location.keys.map(&:to_s))
  end
end
