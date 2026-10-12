module Api
  module V1
    module Auth
      class RegistrationsController < Devise::RegistrationsController
        respond_to :json

        # Arbitrary constant naming the Postgres advisory lock that serializes first-run setup.
        SETUP_LOCK_KEY = 7_424_001

        # First-run setup only — no JWT required. Creates the company and its admin
        # user, then refuses every later call so a private install cannot be used to
        # create a second company. Further users are invited by an admin.
        def create
          ActiveRecord::Base.transaction do
            # Two simultaneous first requests must not both pass the check below.
            ActiveRecord::Base.connection.execute("SELECT pg_advisory_xact_lock(#{SETUP_LOCK_KEY})")

            if Organization.setup_complete?
              render json: {
                code: "SETUP_COMPLETE",
                errors: ["Setup is already complete. Ask an administrator to invite you."]
              }, status: :forbidden
              raise ActiveRecord::Rollback
            end

            organization = build_organization
            build_resource(sign_up_params)
            resource.organization = organization
            resource.role = "admin"

            unless organization.valid? && resource.valid?
              errors = organization.errors.full_messages + resource.errors.full_messages
              render json: { errors: errors }, status: :unprocessable_entity
              raise ActiveRecord::Rollback
              return
            end

            organization.save!
            resource.save!
          end

          return if performed?

          sign_up(resource_name, resource)
          respond_with resource, {}
        end

        private

        def build_organization
          name = params.dig(:user, :organization_name).to_s.strip
          subdomain = name.parameterize
          Organization.new(name: name, subdomain: subdomain)
        end

        def sign_up_params
          params.require(:user).permit(:email, :password, :password_confirmation,
            :first_name, :last_name, :phone)
        end

        def respond_with(resource, _opts = {})
          if resource.persisted?
            render json: {
              message: "Account created successfully",
              user: UserBlueprint.render_as_hash(resource)
            }, status: :created
          else
            render json: { errors: resource.errors.full_messages }, status: :unprocessable_entity
          end
        end
      end
    end
  end
end
