module Api
  module V1
    # The signed-in person's own two-factor sign-in (authenticator app). Setting up is two calls (create makes a secret,
    # confirm proves the app has it and switches it on); turning it off or getting new recovery codes needs the
    # password and a current code, so a borrowed, unlocked session cannot weaken the account.
    class TwoFactorController < Api::V1::BaseController
      skip_before_action :require_two_factor_when_company_does

      rescue_from TwoFactorAuth::Locked do |error|
        render_error(error.message, :too_many_requests, code: "TWO_FACTOR_LOCKED")
      end

      # GET /api/v1/profile/two_factor
      def show
        render json: status
      end

      # POST /api/v1/profile/two_factor: a new secret, as an address for a QR code and a key to type. Nothing is on yet.
      def create
        if current_user.two_factor_enabled?
          return render_error("Two-factor sign-in is already on.", :conflict, code: "TWO_FACTOR_ALREADY_ON")
        end

        render json: status.merge(setup: current_user.start_two_factor_setup!), status: :created
      end

      # POST /api/v1/profile/two_factor/confirm { code }: switches it on, and returns the recovery codes, once.
      def confirm
        codes = current_user.enable_two_factor!(params[:code])
        unless codes
          return render_error("That code is not right. Check the app and try again.", :unprocessable_entity,
                              code: "TWO_FACTOR_INVALID")
        end

        ActivityLogService.log(action: "user.two_factor_enabled", resource: current_user)
        render json: status.merge(recovery_codes: codes)
      end

      # DELETE /api/v1/profile/two_factor { password, code }
      def destroy
        return unless confirmed_by_password_and_code?

        current_user.disable_two_factor!
        ActivityLogService.log(action: "user.two_factor_disabled", resource: current_user)
        render json: status
      end

      # POST /api/v1/profile/two_factor/recovery_codes { password, code }: new codes; the old ones stop working.
      def recovery_codes
        return unless confirmed_by_password_and_code?

        ActivityLogService.log(action: "user.recovery_codes_renewed", resource: current_user)
        render json: status.merge(recovery_codes: current_user.regenerate_recovery_codes!)
      end

      private

      def status
        user = current_user.reload
        { two_factor: {
          enabled: user.two_factor_enabled?, enabled_at: user.otp_enabled_at, recovery_codes_left: user.recovery_codes_left,
          required_by_company: current_organization.require_two_factor?
        } }
      end

      # Renders the refusal itself and returns false when the password or the code is wrong.
      def confirmed_by_password_and_code?
        unless current_user.valid_password?(params[:password].to_s)
          render_error("Your password is not right.", :unprocessable_entity, code: "PASSWORD_INVALID")
          return false
        end
        return true if current_user.verify_second_factor!(params[:code])

        render_error("That code is not right.", :unprocessable_entity, code: "TWO_FACTOR_INVALID")
        false
      end
    end
  end
end
