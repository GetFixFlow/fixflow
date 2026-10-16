class Current < ActiveSupport::CurrentAttributes
  attribute :user
  attribute :request_ip
  attribute :user_agent
end
