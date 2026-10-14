module Api
  module V1
    # How dates, times, numbers and money are shown. Everyone signed in reads it (every screen
    # needs it); administrators change it. The time zone is the same one as in the company settings.
    class LocalizationSettingsController < Api::V1::BaseController
      before_action :require_admin!, only: :update

      # GET /api/v1/localization_settings
      def show
        render json: { localization: payload }
      end

      # PATCH /api/v1/localization_settings
      def update
        org = current_organization
        org.assign_company_settings(localization_params)
        org.save!
        ActivityLogService.log(action: "localization_settings.updated", resource: org, metadata: payload)
        render json: { localization: payload }
      end

      private

      def localization_params
        params.expect(localization: OrganizationSettings::LOCALIZATION_KEYS.map(&:to_sym))
      end

      def payload
        current_organization.settings_with_defaults.slice(*OrganizationSettings::LOCALIZATION_KEYS)
      end
    end
  end
end
