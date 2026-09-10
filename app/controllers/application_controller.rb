class ApplicationController < ActionController::API
  include Pagy::Backend
  include SecureHeaders if defined?(SecureHeaders)

  before_action :set_request_id

  private

  def set_request_id
    @request_id = request.headers["X-Request-ID"].presence || SecureRandom.uuid
    response.set_header("X-Request-ID", @request_id)
  end
end
