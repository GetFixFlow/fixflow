module Api
  module V1
    class OrganizationSettingsController < Api::V1::BaseController
      before_action :require_admin!, only: :update

      # GET /api/v1/organization_settings
      def show
        render json: { organization: payload }
      end

      # PATCH /api/v1/organization_settings
      def update
        org = current_organization
        before = payload
        attrs = settings_params
        org.name = attrs.delete(:name) if attrs.key?(:name)
        org.assign_company_settings(attrs)
        org.save!
        log_changes(before)
        render json: { organization: payload }
      end

      private

      def settings_params
        params.expect(
          organization: [
            :name, :industry, :size, :website, :address, :timezone, :wo_number_prefix,
            :default_priority, :default_due_days, :labor_rate, :require_completion_notes, :auto_close_days,
            :pm_compliance_target, :pm_reminder_days, :pm_pause_on_down, :iot_alert_cooldown,
            :iot_stale_threshold, :iot_data_retention_days, :audit_log_retention_days, :iot_auto_wo_threshold,
            :update_check, :public_requests_enabled, :require_two_factor,
            { work_hours: %i[start end], work_days: [], holidays: [%i[date name repeating]] }
          ]
        )
      end

      # One line naming the settings that changed (not their values).
      def log_changes(before)
        changed = payload.reject { |key, value| before[key] == value }.keys
        return if changed.empty?

        ActivityLogService.log(action: "organization_settings.updated", resource: current_organization,
                               metadata: { changed: changed })
      end

      def payload
        org = current_organization
        org.settings_with_defaults.merge("name" => org.name, "slug" => org.subdomain)
      end
    end
  end
end
