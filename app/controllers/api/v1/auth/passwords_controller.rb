module Api
  module V1
    module Auth
      # Public. Anyone can ask for a link; it is only ever sent to the account's own email.
      class PasswordsController < Api::V1::BaseController
        skip_before_action :authenticate_user!
        skip_before_action :set_current_context

        ASKED = "If that email belongs to an account, a link to reset the password is on its way. " \
                "If your administrator has not set up email, ask them for a reset link.".freeze

        # POST /api/v1/auth/password  { user: { email } }
        # The answer is the same whether or not the account exists, so this cannot be used
        # to find out who has an account.
        def create
          user = User.find_by(email: params.dig(:user, :email).to_s.strip.downcase)
          send_reset_link(user) if user&.can_reset_password?
          render json: { message: ASKED }
        end

        # PUT /api/v1/auth/password  { user: { reset_password_token, password, password_confirmation } }
        # Checks that the person may reset before touching the password.
        def update
          attrs = reset_params
          user = User.with_reset_password_token(attrs[:reset_password_token].to_s)
          return render_invalid_link unless user&.can_reset_password? && user.reset_password_period_valid?

          if user.reset_password(attrs[:password], attrs[:password_confirmation])
            user.update!(jti: SecureRandom.uuid) # every token issued before the reset stops working
            render json: { message: "Password changed. You can sign in now." }
          else
            render_error(user.errors.full_messages.first, :unprocessable_entity,
                         code: "VALIDATION_ERROR", details: user.errors.as_json)
          end
        end

        private

        def reset_params
          params.expect(user: %i[reset_password_token password password_confirmation])
        end

        def send_reset_link(user)
          return unless EmailSetup.configured?

          PasswordMailer.reset(user, user.reset_password_url).deliver_later
        end

        def render_invalid_link
          render_error("This reset link is invalid or has expired. Ask for a new one.",
                       :unprocessable_entity, code: "RESET_LINK_INVALID")
        end
      end
    end
  end
end
