module ApplicationCable
  class Connection < ActionCable::Connection::Base
    identified_by :current_user

    def connect
      self.current_user = find_verified_user
    end

    private

    def find_verified_user
      token = request.params[:token] ||
              request.headers["Authorization"].to_s.split(" ").last

      return reject_unauthorized_connection unless token.present?

      payload = Warden::JWTAuth::TokenDecoder.new.call(token)
      # Same rules as a normal request: the token's session must still be live (signing out,
      # revoking it, a password change or deactivation end it) and the user active.
      user = User.find_by(id: payload["sub"])

      user&.active? && !User.jwt_revoked?(payload, user) ? user : reject_unauthorized_connection
    rescue JWT::DecodeError
      reject_unauthorized_connection
    end
  end
end
