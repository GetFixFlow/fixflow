module Api
  module V1
    # The fields an administrator adds to work orders and parts. Anyone signed in reads the ones that are on (the forms
    # need them); an administrator also sees those turned off, and keeps the list.
    class CustomFieldsController < Api::V1::BaseController
      before_action :set_custom_field, only: %i[update destroy]
      before_action :authorize_custom_field

      # GET /api/v1/custom_fields?entity=work_order|part
      def index
        scope = current_organization.custom_fields
        scope = scope.where(entity: params[:entity]) if params[:entity].present?
        scope = scope.active unless current_user.admin?
        render json: { custom_fields: CustomFieldBlueprint.render_as_hash(scope.ordered) }
      end

      # POST /api/v1/custom_fields  { custom_field: { entity, label, kind, options, required, in_list } }
      def create
        field = current_organization.custom_fields.new(create_params)
        field.position = current_organization.custom_fields.where(entity: field.entity).maximum(:position).to_i + 1
        field.save!
        render json: { data: CustomFieldBlueprint.render_as_hash(field) }, status: :created
      end

      # PATCH /api/v1/custom_fields/:id  (the label, choices, required, in_list and active; not the kind or key)
      def update
        @custom_field.update!(update_params)
        render json: { data: CustomFieldBlueprint.render_as_hash(@custom_field) }
      end

      # PATCH /api/v1/custom_fields/reorder  { entity, ids: [...] }  the order the forms and lists show them in
      def reorder
        fields = current_organization.custom_fields.where(entity: params[:entity]).index_by(&:id)
        ids = Array(params[:ids]).map(&:to_i)
        unless ids.sort == fields.keys.sort
          return render_error("Send every field of this kind, once each", :unprocessable_entity, code: "VALIDATION_ERROR")
        end

        CustomField.transaction { ids.each_with_index { |id, index| fields[id].update!(position: index + 1) } }
        render json: { custom_fields: CustomFieldBlueprint.render_as_hash(fields.values.sort_by(&:position)) }
      end

      # DELETE /api/v1/custom_fields/:id  Takes what was filled in with it. (Turning the field off keeps it.)
      def destroy
        @custom_field.destroy!
        head :no_content
      end

      private

      def set_custom_field
        @custom_field = current_organization.custom_fields.find(params[:id])
      end

      def authorize_custom_field
        authorize(@custom_field || CustomField)
      end

      def create_params
        params.expect(custom_field: [:entity, :label, :kind, :required, :in_list, { options: [] }])
      end

      def update_params
        params.expect(custom_field: [:label, :required, :in_list, :active, { options: [] }])
      end
    end
  end
end
