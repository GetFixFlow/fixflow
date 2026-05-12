module Api
  module V1
    module Auth
      class RegistrationsController < Devise::RegistrationsController
        respond_to :json

        # Public endpoint — no JWT required to register a new org + admin user
        def create
          ActiveRecord::Base.transaction do
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
