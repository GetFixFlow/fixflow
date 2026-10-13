module Api
  module V1
    # How this install looks. Reading it is public: the sign-in page needs the logo, colour and
    # headline before anyone has signed in. Changing it is for administrators.
    class BrandingController < Api::V1::BaseController
      skip_before_action :authenticate_user!, only: :show
      skip_before_action :set_current_context, only: :show
      before_action :require_admin!, only: :update

      # GET /api/v1/branding
      def show
        org = Organization.order(:id).first
        render json: { branding: org ? payload(org) : defaults }
      end

      # PATCH /api/v1/branding  (multipart: branding[logo], branding[favicon], branding[remove_logo], ...)
      def update
        org = current_organization
        attrs = branding_params
        images = attrs.slice(:logo, :favicon)
        return render_error("That is not an image.", :unprocessable_entity, code: "VALIDATION_ERROR") unless images.values.all? { |f|
          real_image?(f)
        }

        org.assign_branding(attrs.slice(:primary_color, :login_headline, :login_subtitle))
        # Assigned, not attached: they are saved together with everything else, or not at all.
        org.logo = images[:logo] if images[:logo]
        org.favicon = images[:favicon] if images[:favicon]
        org.save!

        org.logo.purge if flag?(attrs[:remove_logo]) && !images[:logo] && org.logo.attached?
        org.favicon.purge if flag?(attrs[:remove_favicon]) && !images[:favicon] && org.favicon.attached?

        ActivityLogService.log(action: "branding.updated", resource: org, metadata: { primary_color: org.branding["primary_color"] })
        render json: { branding: payload(org) }
      end

      private

      def branding_params
        params.expect(branding: %i[primary_color login_headline login_subtitle logo favicon remove_logo remove_favicon])
      end

      def flag?(value) = ActiveModel::Type::Boolean.new.cast(value)

      # What the file is, judged by its contents, not by what it says it is.
      def real_image?(file)
        file.respond_to?(:tempfile) && Marcel::MimeType.for(file.tempfile).to_s.start_with?("image/")
      ensure
        file.tempfile.rewind if file.respond_to?(:tempfile)
      end

      def defaults
        OrganizationBranding::DEFAULTS.merge("name" => "FixFlow", "logo_url" => nil, "favicon_url" => nil)
      end

      def payload(org)
        org.branding.merge("name" => org.name, "logo_url" => blob_path(org.logo), "favicon_url" => blob_path(org.favicon))
      end

      def blob_path(attachment)
        Rails.application.routes.url_helpers.rails_blob_path(attachment, only_path: true) if attachment.attached?
      end
    end
  end
end
