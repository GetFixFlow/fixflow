module Api
  module V1
    class LocationsController < Api::V1::BaseController
      before_action :require_manager!, only: %i[create update]
      before_action :require_admin!,   only: %i[destroy]
      before_action :set_location,     only: %i[show update destroy]

      # GET /api/v1/locations — returns full tree of org's locations
      def index
        roots = current_organization.locations
          .roots
          .order(:name)
        render json: { locations: LocationBlueprint.render_as_hash(roots, view: :tree) }
      end

      # GET /api/v1/locations/tree — explicit tree alias
      def tree
        roots = current_organization.locations
          .roots
          .order(:name)
        render json: { locations: LocationBlueprint.render_as_hash(roots, view: :tree) }
      end

      # GET /api/v1/locations/:id
      def show
        render json: { data: LocationBlueprint.render_as_hash(@location, view: :extended) }
      end

      # POST /api/v1/locations
      def create
        location = current_organization.locations.build(location_params)
        validate_parent_org!(location) && return if location.parent_id
        location.save!
        render json: { data: LocationBlueprint.render_as_hash(location) }, status: :created
      end

      # PATCH /api/v1/locations/:id
      def update
        @location.assign_attributes(location_params)
        if location_params[:parent_id].present?
          validate_no_cycle!(@location) && return
          validate_parent_org!(@location) && return
        end
        @location.save!
        render json: { data: LocationBlueprint.render_as_hash(@location) }
      end

      # DELETE /api/v1/locations/:id
      def destroy
        @location.destroy!
        head :no_content
      end

      private

      def set_location
        @location = current_organization.locations.find(params[:id])
      end

      def location_params
        params.require(:location).permit(:name, :location_type, :parent_id)
      end

      # Prevent making a location a child of one of its own descendants.
      def validate_no_cycle!(location)
        new_parent_id = location.parent_id.to_i
        if new_parent_id == location.id || location.descendant_ids.include?(new_parent_id)
          render_error("Circular reference: a location cannot be its own ancestor", :unprocessable_entity)
          true
        end
      end

      # Ensure the chosen parent belongs to the same organization.
      def validate_parent_org!(location)
        parent = Location.find_by(id: location.parent_id)
        unless parent&.organization_id == current_organization.id
          render_error("Parent location does not belong to your organization", :unprocessable_entity)
          return true
        end
        false
      end
    end
  end
end
