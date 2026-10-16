# For the sign-in and sign-up controllers: note where the request came from before the token is
# made, so the session it starts can say which browser and address it belongs to.
module RecordsClient
  extend ActiveSupport::Concern

  included do
    before_action :remember_client
  end

  private

  def remember_client
    Current.request_ip = request.remote_ip
    Current.user_agent = request.user_agent
  end
end
