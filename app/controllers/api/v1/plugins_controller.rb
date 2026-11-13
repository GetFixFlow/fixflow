module Api
  module V1
    # The plugins installed on the server, and what this company has done with them. Administrators only. A plugin is put on the
    # server by whoever runs it (a folder in plugins/); here the company's administrator switches it on and sets up its
    # notification channels. Secrets a channel asks for are never sent back, only whether each is set.
    class PluginsController < Api::V1::BaseController
      wrap_parameters false # the body names its own keys (plugin, channel); the address names the plugin and channel
      before_action :require_admin!
      before_action :find_plugin, except: :index
      before_action :find_channel, only: %i[update_channel destroy_channel test_channel]

      # GET /api/v1/plugins
      def index
        render json: {
          plugins: Plugins.installed.map { |plugin| plugin_json(plugin) },
          failures: Plugins.failures.map { |failure| { folder: failure.folder, message: failure.message } },
          api_version: Plugins::API_VERSION,
          available_events: ChatConfig::EVENTS.map { |key, label| { key: key, label: label } }
        }
      end

      # PATCH /api/v1/plugins/:key  { plugin: { enabled: true } }
      def update
        enabled = ActiveModel::Type::Boolean.new.cast(params.expect(plugin: [:enabled])[:enabled]) == true
        Plugins::Settings.for(current_organization).set_enabled(@plugin.key, enabled)
        ActivityLogService.log(action: enabled ? "plugin.enabled" : "plugin.disabled", resource: current_organization,
                               metadata: { plugin: @plugin.key })
        render json: { plugin: plugin_json(@plugin) }
      end

      # PUT /api/v1/plugins/:key/channels/:channel  { channel: { enabled, events: [], values: { field => text } } }
      # A blank secret keeps the one saved.
      def update_channel
        problems = Plugins::Settings.for(current_organization).update_channel(@channel, channel_params)
        return render_error(problems.first, :unprocessable_entity, code: "VALIDATION_ERROR", details: problems) if problems.any?

        state = channel_state
        ActivityLogService.log(action: "plugin.channel_updated", resource: current_organization,
                               metadata: { plugin: @plugin.key, channel: @channel.key, enabled: state.enabled, events: state.events })
        render json: { plugin: plugin_json(@plugin) }
      end

      # DELETE /api/v1/plugins/:key/channels/:channel: forget how it was set up, secrets included.
      def destroy_channel
        Plugins::Settings.for(current_organization).forget_channel(@channel)
        ActivityLogService.log(action: "plugin.channel_removed", resource: current_organization,
                               metadata: { plugin: @plugin.key, channel: @channel.key })
        render json: { plugin: plugin_json(@plugin) }
      end

      # POST /api/v1/plugins/:key/channels/:channel/test  { channel: { values: {...} } }
      # Sends a message through the channel with the values given over the saved ones, without saving them, so they can be
      # checked before they are used. The answer says in words what went wrong.
      def test_channel
        state = channel_state.assign(@channel, enabled: true, values: params.fetch(:channel, {}).permit(values: {})[:values] || {})
        problems = state.problems(@channel)
        return render_error(problems.first, :unprocessable_entity, code: "VALIDATION_ERROR", details: problems) if problems.any?

        Plugins::Channels.test(current_organization, @channel, state, current_user)
        render json: { success: true, message: "Test message sent." }
      rescue Plugins::Refused, Plugins::Unavailable => e
        render_error(e.message, :unprocessable_entity, code: "PLUGIN_TEST_FAILED")
      end

      private

      def find_plugin
        @plugin = Plugins.find(params[:key])
        render_error("Plugin not found", :not_found, code: "RESOURCE_NOT_FOUND") unless @plugin
      end

      def find_channel
        @channel = @plugin.find_channel(params[:channel_key])
        render_error("Channel not found", :not_found, code: "RESOURCE_NOT_FOUND") unless @channel
      end

      def channel_params
        params.expect(channel: [:enabled, { events: [], values: {} }])
      end

      def channel_state
        Plugins::Settings.for(current_organization.reload).channel(@plugin.key, @channel.key)
      end

      def plugin_json(plugin)
        settings = Plugins::Settings.for(current_organization.reload)
        {
          key: plugin.key, title: plugin.title, version: plugin.version, summary: plugin.summary, author: plugin.author,
          folder: plugin.source, enabled: settings.enabled?(plugin.key),
          reports: plugin.reports.map { |report| { key: report.key, title: report.title, description: report.description } },
          channels: plugin.channels.map { |channel| channel_json(plugin, channel, settings) }
        }
      end

      def channel_json(plugin, channel, settings)
        { key: channel.key, title: channel.title, summary: channel.summary, fields: channel.fields.map(&:as_json) }
          .merge(settings.channel(plugin.key, channel.key).to_screen(channel))
      end
    end
  end
end
