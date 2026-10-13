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
      # Same rules as a normal request: the token must still be the user's current one
      # (sign-out, password change and deactivation all rotate it) and the user active.
      user = User.find_by(id: payload["sub"], jti: payload["jti"])

      user&.active? ? user : reject_unauthorized_connection
    rescue JWT::DecodeError
      reject_unauthorized_connection
    end
  end
end
