class ApiKeyBlueprint < Blueprinter::Base
  identifier :id

  fields :name, :active, :last_used_at, :expires_at, :created_at
  # What it may do: a key from before scopes existed may only send sensor readings.
  field(:scopes, &:effective_scopes)
  # The first characters, to tell keys apart on screen (the rest is shown once, when the key is made).
  field(:prefix, &:key_hint)

  # key_digest is intentionally excluded — never serialized
end
