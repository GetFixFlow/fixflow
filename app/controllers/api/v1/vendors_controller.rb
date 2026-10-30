module Api
  module V1
    # The outside companies that do maintenance work. Managers keep the list; a work order is given to a vendor in
    # WorkOrdersController. A vendor that has done work is deactivated, not deleted (so the work orders keep the name).
    class VendorsController < Api::V1::BaseController
      before_action :set_vendor, only: %i[show update destroy]
      before_action :authorize_vendor

      # GET /api/v1/vendors?search=&category=&active=true|false
      def index
        scope = current_organization.vendors
        if params[:search].present?
          scope = scope.where("name ILIKE :q OR category ILIKE :q",
q: "%#{Vendor.sanitize_sql_like(params[:search])}%")
        end
        scope = scope.where("lower(category) = ?", params[:category].to_s.downcase) if params[:category].present?
        scope = scope.where(active: ActiveModel::Type::Boolean.new.cast(params[:active])) if params[:active].present?
        pagy, vendors = pagy(scope.order(Arel.sql("lower(vendors.name)")))
        render json: {
          vendors: VendorBlueprint.render_as_hash(vendors, counts: work_order_counts(vendors.map(&:id))),
          categories: current_organization.vendors.where.not(category: nil).distinct.order(:category).pluck(:category),
          meta: pagy_metadata_response(pagy)
        }
      end

      def show
        render json: { data: VendorBlueprint.render_as_hash(@vendor, view: :extended, counts: work_order_counts([@vendor.id])) }
      end

      # POST /api/v1/vendors  { vendor: { name, category, phone, email, website, address, notes } }
      def create
        vendor = current_organization.vendors.create!(vendor_params)
        render json: { data: VendorBlueprint.render_as_hash(vendor, view: :extended) }, status: :created
      end

      def update
        @vendor.update!(vendor_params)
        render json: { data: VendorBlueprint.render_as_hash(@vendor, view: :extended, counts: work_order_counts([@vendor.id])) }
      end

      # DELETE /api/v1/vendors/:id (administrators; refused once the vendor has work orders: deactivate instead)
      def destroy
        unless @vendor.destroy
          return render_error("This vendor has work orders, so it cannot be deleted. Deactivate it instead.",
                              :unprocessable_entity, code: "VENDOR_IN_USE")
        end

        head :no_content
      end

      private

      def work_order_counts(ids)
        current_organization.work_orders.where(vendor_id: ids).group(:vendor_id).count
      end

      def set_vendor
        @vendor = current_organization.vendors.find(params[:id])
      end

      def authorize_vendor
        authorize(@vendor || Vendor)
      end

      def vendor_params
        params.expect(vendor: %i[name category phone email website address notes active])
      end
    end
  end
end
