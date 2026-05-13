class ApiKeyBlueprint < Blueprinter::Base
  identifier :id

  fields :name, :active, :scopes, :last_used_at, :expires_at, :created_at

  # key_digest is intentionally excluded — never serialized
end
