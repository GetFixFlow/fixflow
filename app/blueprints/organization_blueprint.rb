class OrganizationBlueprint < Blueprinter::Base
  identifier :id
  fields :name, :subdomain, :settings, :created_at
end
