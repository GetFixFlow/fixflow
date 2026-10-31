module Api
  module V1
    # Asking for parts and buying them. Anyone who works on equipment can ask (and sees their own requests); managers see
    # them all, approve or turn down, order from a vendor and say what has arrived, which adds to the stock.
    class PurchaseOrdersController < Api::V1::BaseController
      MANAGER_FIELDS = %w[vendor_id supplier_reference expected_on].freeze

      before_action :set_order, only: %i[show update approve reject order receive close cancel]
      before_action :authorize_order
      before_action :require_manager_for_buying_fields!, only: %i[create update]

      # GET /api/v1/purchase_orders?status=requested,approved&search=&vendor_id=&part_id=
      def index
        scope = filtered(policy_scope(current_organization.purchase_orders))
        pagy, orders = pagy(scope.includes(:vendor, :requested_by, :decided_by, :lines).order(id: :desc))
        render json: {
          purchase_orders: PurchaseOrderBlueprint.render_as_hash(orders),
          waiting_for_approval: current_user.manager_or_above? ? current_organization.purchase_orders.waiting_for_approval.count : nil,
          meta: pagy_metadata_response(pagy)
        }
      end

      def show
        render json: { data: render_order }
      end

      # POST /api/v1/purchase_orders  { purchase_order: { reason, notes, ... }, lines: [{ part_id, quantity, unit_cost }] }
      def create
        order = current_organization.purchase_orders.new(order_params.merge(requested_by: current_user))
        apply_lines(order)
        order.save!
        PurchaseRequestedJob.perform_later(order.id)
        render json: { data: render_order(order) }, status: :created
      end

      # Until it is ordered, what is wanted can be changed: the reason, the vendor and the lines.
      def update
        @order.assign_attributes(order_params)
        apply_lines(@order) if params.key?(:lines)
        @order.save!
        render json: { data: render_order }
      end

      def approve
        move(:approve, "approved", decided: true)
      end

      # POST /api/v1/purchase_orders/:id/reject  { reason }
      def reject
        reason = params[:reason].to_s.strip
        return render_error("Say why it is turned down.", :unprocessable_entity, code: "VALIDATION_ERROR") if reason.blank?

        @order.rejection_reason = reason
        move(:reject, "rejected", decided: true)
      end

      # POST /api/v1/purchase_orders/:id/order  { vendor_id, expected_on, supplier_reference }
      def order
        @order.assign_attributes(params.permit(:vendor_id, :expected_on, :supplier_reference))
        if @order.vendor_id.blank?
          return render_error("Choose the vendor to order from.", :unprocessable_entity, code: "VALIDATION_ERROR")
        end

        move(:place_order, "ordered")
      end

      # POST /api/v1/purchase_orders/:id/receive  { lines: [{ id, quantity }] }
      def receive
        quantities = Array(params[:lines]).to_h { |row| [row[:id].to_i, row[:quantity].to_s] }
        arrived = @order.receive!(quantities)
        log("received", lines: arrived, status: @order.status)
        render json: { data: render_order }
      rescue ArgumentError => e
        render_error(e.message, :unprocessable_entity, code: "VALIDATION_ERROR")
      end

      def close
        move(:close, "closed")
      end

      def cancel
        move(:cancel, "cancelled")
      end

      private

      def filtered(scope)
        scope = scope.where(status: params[:status].to_s.split(",")) if params[:status].present?
        scope = scope.where(vendor_id: params[:vendor_id]) if params[:vendor_id].present?
        if params[:part_id].present?
          scope = scope.where(id: PurchaseOrderLine.where(part_id: params[:part_id]).select(:purchase_order_id))
        end
        if params[:search].present?
          scope = scope.where("number ILIKE :q OR reason ILIKE :q", q: "%#{PurchaseOrder.sanitize_sql_like(params[:search])}%")
        end
        scope
      end

      def move(event, verb, decided: false)
        unless @order.public_send(:"may_#{event}?")
          return render_error("This order is #{@order.status.humanize.downcase}, so it cannot be #{verb}.", :unprocessable_entity,
                              code: "INVALID_TRANSITION")
        end

        @order.public_send(event)
        @order.assign_attributes(decided_by: current_user, decided_at: Time.current) if decided
        @order.save!
        log(verb, status: @order.status)
        render json: { data: render_order }
      end

      def log(verb, metadata = {})
        ActivityLogService.log(action: "purchase_order.#{verb}", resource: @order, metadata: metadata)
      end

      def render_order(order = @order)
        PurchaseOrderBlueprint.render_as_hash(order.reload, view: :extended)
      end

      # The lines as sent: a row with an id is a line already there; rows left out are removed; a cost left blank is the
      # part's own.
      def apply_lines(order)
        rows = Array(params[:lines]).map { |row| row.permit(:id, :part_id, :quantity, :unit_cost) }
        existing = order.lines.index_by(&:id)
        kept = rows.map do |row|
          line = existing[row[:id].to_i] || order.lines.build
          line.assign_attributes(part_id: row[:part_id], quantity: row[:quantity], unit_cost: unit_cost_for(row))
          line
        end
        (existing.values - kept).each(&:mark_for_destruction)
      end

      def unit_cost_for(row)
        return row[:unit_cost] if row[:unit_cost].present?

        current_organization.parts.find_by(id: row[:part_id])&.unit_cost
      end

      def require_manager_for_buying_fields!
        return if current_user.manager_or_above?
        return unless params[:purchase_order].respond_to?(:keys) && params[:purchase_order].keys.intersect?(MANAGER_FIELDS)

        render_error("Only managers choose the vendor and say when it should arrive.", :forbidden, code: "FORBIDDEN")
      end

      def set_order
        @order = current_organization.purchase_orders.find(params[:id])
      end

      def authorize_order
        authorize(@order || PurchaseOrder)
      end

      def order_params
        params.expect(purchase_order: %i[reason notes vendor_id supplier_reference expected_on])
      end
    end
  end
end
