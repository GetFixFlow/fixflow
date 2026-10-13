module Api
  module V1
    # The mail server for this install. Administrators only. The password is never sent back.
    class EmailSettingsController < Api::V1::BaseController
      before_action :require_admin!

      # GET /api/v1/email_settings
      def show
        render json: { smtp: payload }
      end

      # PATCH /api/v1/email_settings
      def update
        config = current_organization.smtp_config.assign(smtp_params)
        return render_invalid(config) unless config.valid?

        config.save_to(current_organization)
        ActivityLogService.log(action: "email_settings.updated", resource: current_organization,
metadata: { host: config.host, port: config.port })
        render json: { smtp: payload }
      end

      # DELETE /api/v1/email_settings: go back to the server's environment settings.
      def destroy
        current_organization.update!(email_settings: {})
        ActivityLogService.log(action: "email_settings.removed", resource: current_organization)
        render json: { smtp: payload }
      end

      # POST /api/v1/email_settings/test  { smtp: {...} }
      # Sends a message to the signed-in administrator through the settings given (over the saved
      # ones), without saving them, so a setting can be checked before it is used.
      def test
        config = current_organization.smtp_config.assign(test_params)
        return render_invalid(config) unless config.valid?

        message = SystemMailer.test_email(current_user, from: config.from)
        message.delivery_method(:smtp, config.to_mail_settings)
        message.raise_delivery_errors = true
        message.deliver_now
        render json: { success: true, message: "Test email sent to #{current_user.email}. Check the inbox (and spam)." }
      rescue StandardError => e
        render_error(SmtpDiagnosis.explain(e, config), :unprocessable_entity, code: "EMAIL_TEST_FAILED")
      end

      private

      def smtp_params
        params.expect(smtp: %i[host port username password encryption from_name from_address])
      end

      def test_params
        params.fetch(:smtp, {}).permit(:host, :port, :username, :password, :encryption, :from_name, :from_address)
      end

      def render_invalid(config)
        render_error(config.errors.full_messages.first, :unprocessable_entity, code: "VALIDATION_ERROR", details: config.errors.as_json)
      end

      def payload
        saved = current_organization.smtp_config
        source = EmailSetup.source
        {
          host: saved.host.to_s, port: saved.port, username: saved.username.to_s, encryption: saved.encryption,
          from_name: saved.from_name.to_s, from_address: saved.from_address.to_s,
          password_set: saved.password_set?,
          configured: source.present?,
          source: source,
          environment_host: (ENV.fetch("SMTP_HOST", nil) if EmailSetup.env_configured?)
        }
      end
    end
  end
end
