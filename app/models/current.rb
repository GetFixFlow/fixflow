class Current < ActiveSupport::CurrentAttributes
  attribute :user
  attribute :request_ip
  attribute :api_key_name # set while a request made with an API key is handled: the audit log says which key
  attribute :user_agent
  attribute :hidden_location_ids # the places this person may not see (see SiteAccess); nil when they see everything
  attribute :audit_silenced # set while an import or demo data is written: see Auditable.silenced
end
