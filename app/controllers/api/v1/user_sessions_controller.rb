module Api
  module V1
    # Where the signed-in person is signed in, and a way to end any of those sessions. Only ever
    # their own: a session of someone else cannot be found, let alone ended.
    class UserSessionsController < Api::V1::BaseController
      # GET /api/v1/sessions
      def index
        sessions = live_sessions.order(last_active_at: :desc)
        render json: { sessions: sessions.sort_by { |s| s.sid == current_sid ? 0 : 1 }.map { |s| present(s) } }
      end

      # DELETE /api/v1/sessions/:id
      def destroy
        session = live_sessions.find_by!(sid: params[:id])
        session.revoke!
        log("session.revoked", session)
        head :no_content
      end

      # DELETE /api/v1/sessions/all  ends every session except the one asking
      def destroy_all
        others = live_sessions.where.not(sid: current_sid)
        count = others.count
        others.find_each(&:revoke!)
        log("session.revoked_all", nil, count: count)
        render json: { revoked: count }
      end

      private

      def live_sessions = current_user.user_sessions.live.where(jti: current_user.jti)

      # The session the token in this request belongs to.
      def current_sid
        @current_sid ||= Warden::JWTAuth::TokenDecoder.new.call(Warden::JWTAuth::HeaderParser.from_env(request.env))["sid"]
      end

      def present(session)
        {
          id: session.sid, device: session.device, ip_address: session.ip_address,
          created_at: session.created_at, last_active_at: session.last_active_at,
          current: session.sid == current_sid
        }
      end

      def log(action, session, extra = {})
        ActivityLogService.log(action: action, resource: current_user,
                               metadata: { device: session&.device, ip_address: session&.ip_address }.compact.merge(extra))
      end
    end
  end
end
