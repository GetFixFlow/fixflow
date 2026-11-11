class Current < ActiveSupport::CurrentAttributes
  attribute :user
  attribute :request_ip
  attribute :api_key_name # set while a request made with an API key is handled: the audit log says which key
  attribute :user_agent
  attribute :audit_silenced # set while an import or demo data is written: see Auditable.silenced
end
