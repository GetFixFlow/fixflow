class Current < ActiveSupport::CurrentAttributes
  attribute :user
  attribute :request_ip
  attribute :user_agent
  attribute :audit_silenced # set while an import or demo data is written: see Auditable.silenced
end
