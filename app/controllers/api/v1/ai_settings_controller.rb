module Api
  module V1
    # Which AI provider the company uses. Administrators only. AI is off until one is picked. A key is never sent back, only
    # whether one is saved.
    class AiSettingsController < Api::V1::BaseController
      before_action :require_admin!

      TEST_PROMPT = "Reply with the single word: ready".freeze

      # GET /api/v1/ai_settings
      def show
        render json: { ai: payload }
      end

      # PATCH /api/v1/ai_settings  { ai: { provider, model, base_url, api_key, features: { priority, anomalies } } }
      # The fields are the chosen provider's own. A blank key keeps the saved one, unless the address changed. A request with
      # only `features` switches those on or off and leaves the provider as it is.
      def update
        config = current_organization.ai_config.assign(ai_params)
        return render_invalid(config) unless config.valid?

        config.save_to(current_organization)
        model = config.model unless config.provider == "none"
        ActivityLogService.log(action: "ai_settings.updated", resource: current_organization,
                               metadata: { provider: config.provider, model: model, host: config.where,
                                           features: config.features })
        render json: { ai: payload }
      end

      # DELETE /api/v1/ai_settings: forget it all (a server set up through its environment goes back to using that).
      def destroy
        current_organization.update!(ai_settings: {})
        ActivityLogService.log(action: "ai_settings.removed", resource: current_organization)
        render json: { ai: payload }
      end

      # POST /api/v1/ai_settings/test  { ai: { provider, model, base_url, api_key } }
      # Asks the model a fixed question through the settings given (over the saved ones) without saving them. No company data
      # is sent. The answer says in words what went wrong.
      def test
        config = AiConfig.effective(current_organization).assign(test_params)
        return render_error("Choose a provider first.", :unprocessable_entity, code: "VALIDATION_ERROR") if config.provider == "none"
        return render_invalid(config) unless config.valid?

        started = Process.clock_gettime(Process::CLOCK_MONOTONIC)
        reply = ::Ai::Client.provider_for(config).chat(messages: [{ role: "user", content: TEST_PROMPT }], max_tokens: 32)
        seconds = (Process.clock_gettime(Process::CLOCK_MONOTONIC) - started).round(1)
        render json: { success: true, message: "Connected. #{config.where} answered in #{seconds} s.",
                       reply: reply.to_s.strip.truncate(80) }
      rescue ::Ai::Client::Error => e
        render_error(e.message, :unprocessable_entity, code: "AI_TEST_FAILED")
      end

      private

      def ai_params
        params.expect(ai: [:provider, :model, :base_url, :api_key, { features: ::AiConfig::FEATURES }])
      end

      def test_params
        params.fetch(:ai, {}).permit(:provider, :model, :base_url, :api_key)
      end

      def render_invalid(config)
        render_error(config.errors.full_messages.first, :unprocessable_entity, code: "VALIDATION_ERROR", details: config.errors.as_json)
      end

      # What AI runs on now, and each provider's own settings (the keys only as "set").
      def payload
        config = ::AiConfig.effective(current_organization)
        {
          provider: config.provider, enabled: config.active?, source: config.source, where: config.where,
          features: ::AiConfig::FEATURES.index_with { |name| config.features.fetch(name) },
          environment_configured: ::AiConfig.effective(nil).source == "environment",
          providers: ::AiConfig::FIELDS.keys.index_with { |kind| provider_payload(config, kind) }
        }
      end

      def provider_payload(config, kind)
        one = config.setting(kind)
        { model: one.model, default_model: ::AiConfig::DEFAULT_MODELS[kind], base_url: one.base_url, key_set: one.key_set? }.compact
      end
    end
  end
end
