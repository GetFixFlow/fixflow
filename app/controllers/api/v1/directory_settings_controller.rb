module Api
  module V1
    # How the company signs in through its directory. Administrators only. The secrets are never sent back.
    class DirectorySettingsController < Api::V1::BaseController
      before_action :require_admin!

      # GET /api/v1/directory_settings
      def show
        render json: payload(current_organization.directory_settings_config)
      end

      # PATCH /api/v1/directory_settings
      def update
        settings = current_organization.directory_settings_config.assign(submitted)
        return render_invalid(settings) unless settings.valid?

        settings.save_to(current_organization)
        ActivityLogService.log(action: "directory_settings.updated", resource: current_organization,
                               metadata: { oidc: settings.oidc?, ldap: settings.ldap? })
        render json: payload(settings)
      end

      # DELETE /api/v1/directory_settings: back to FixFlow passwords only.
      def destroy
        current_organization.update!(directory_settings: {})
        ActivityLogService.log(action: "directory_settings.removed", resource: current_organization)
        render json: payload(DirectorySettings.new)
      end

      # POST /api/v1/directory_settings/test { settings: {...}, kind: "oidc" | "ldap", login:, password: }
      # Tries the settings given (over the saved ones) without saving them. For LDAP, a person's login and password can
      # be added to see what the directory says about them and the role they would get; neither is kept.
      def test
        settings = current_organization.directory_settings_config.assign(submitted)
        case params[:kind]
        when "oidc" then render json: check_oidc(settings)
        when "ldap" then render json: check_ldap(settings)
        else render_error("kind must be oidc or ldap", :bad_request, code: "BAD_REQUEST")
        end
      rescue Directory::Error => e
        render_error(e.message, :unprocessable_entity, code: "DIRECTORY_TEST_FAILED")
      end

      private

      def check_oidc(settings)
        unless settings.oidc_issuer.present? && settings.oidc_client_id.present?
          raise Directory::Error,
"Enter the issuer address and the client id first"
        end

        Directory::Oidc.new(settings).check
      end

      def check_ldap(settings)
        unless settings.ldap_host.present? && settings.ldap_user_base.present?
          raise Directory::Error,
"Enter the server and the base to search for people first"
        end

        ldap = Directory::Ldap.new(settings)
        result = ldap.check
        login = params[:login].to_s.strip
        return result if login.blank?

        identity = ldap.authenticate(login, params[:password].to_s)
        result.merge(person: person_report(identity, settings))
      end

      def person_report(identity, settings)
        return { found: false } unless identity

        { found: true, email: identity.email, first_name: identity.first_name, last_name: identity.last_name,
          groups: identity.groups, role: Directory::Roles.resolve(identity.groups, settings) }
      end

      def submitted
        raw = params.fetch(:settings, {}) # nothing to change is not an error: the saved settings are tried or kept
        raw.permit(*DirectorySettings::PLAIN_FIELDS.excluding("role_groups"), *DirectorySettings::SECRET_FIELDS.keys).to_h.tap do |hash|
          hash["role_groups"] = raw_role_groups if raw.key?(:role_groups)
        end
      end

      # Role names to lists of group names, or text with a group on each line.
      def raw_role_groups
        groups = params.dig(:settings, :role_groups)
        return {} unless groups.respond_to?(:to_unsafe_h)

        groups.to_unsafe_h.slice(*User::ROLES).transform_values { |v| v.is_a?(Array) ? v.map(&:to_s) : v.to_s }
      end

      def payload(settings)
        { settings: settings.as_form, callback_url: Directory::Oidc.new(settings).callback_url }
      end

      def render_invalid(settings)
        render_error(settings.errors.full_messages.first, :unprocessable_entity, code: "VALIDATION_ERROR",
details: settings.errors.as_json)
      end
    end
  end
end
