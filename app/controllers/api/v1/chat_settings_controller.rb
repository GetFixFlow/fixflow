module Api
  module V1
    # Where the company's chat messages go (Slack, Microsoft Teams...). Administrators only. The webhook address is a secret: it is
    # never sent back, only the name of its host so it can be recognised.
    class ChatSettingsController < Api::V1::BaseController
      before_action :require_admin!

      # GET /api/v1/chat_settings
      def show
        render json: { chat: payload }
      end

      # PATCH /api/v1/chat_settings  { chat: { kind, enabled, events: [], url } }   (a blank url keeps the saved one)
      def update
        config = current_organization.chat_config.assign(chat_params)
        return render_invalid(config) unless config.valid?

        config.save_to(current_organization)
        ActivityLogService.log(action: "chat_settings.updated", resource: current_organization,
                               metadata: { kind: config.kind, enabled: config.enabled, events: config.events })
        render json: { chat: payload }
      end

      # DELETE /api/v1/chat_settings: stop posting, and forget the address.
      def destroy
        current_organization.update!(chat_settings: {})
        ActivityLogService.log(action: "chat_settings.removed", resource: current_organization)
        render json: { chat: payload }
      end

      # POST /api/v1/chat_settings/test  { chat: { kind, url } }
      # Posts a message through the address given (over the saved one) without saving it, so it can be checked before it is
      # used. The answer says in words what the chat service said.
      def test
        config = current_organization.chat_config.assign(test_params)
        config.enabled = true
        return render_invalid(config) unless config.valid?

        content = ChatMessage::Content.new(title: "FixFlow is connected",
                                           body: "This is a test message from #{current_user.full_name}.",
                                           link: EmailSetup.base_url)
        ChatDelivery.new(config).deliver(content)
        render json: { success: true, message: "Test message sent. Look for it in the channel." }
      rescue ChatDelivery::Refused, ChatDelivery::Unavailable => e
        render_error(e.message, :unprocessable_entity, code: "CHAT_TEST_FAILED")
      end

      private

      def chat_params
        params.expect(chat: [:kind, :enabled, :url, { events: [] }])
      end

      def test_params
        params.fetch(:chat, {}).permit(:kind, :url)
      end

      def render_invalid(config)
        render_error(config.errors.full_messages.first, :unprocessable_entity, code: "VALIDATION_ERROR", details: config.errors.as_json)
      end

      def payload
        saved = current_organization.chat_config
        {
          kind: saved.kind, enabled: saved.enabled, events: saved.events, url_set: saved.url_set?, url_hint: saved.url_hint,
          last_sent_at: saved.last_sent_at, last_error: saved.last_error,
          available_events: ChatConfig::EVENTS.map { |key, label| { key: key, label: label } }
        }
      end
    end
  end
end
