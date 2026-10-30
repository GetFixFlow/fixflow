module Api
  module V1
    # The people to call at a vendor. Whoever may change the vendor may change its contacts.
    class VendorContactsController < Api::V1::BaseController
      before_action :set_vendor
      before_action :set_contact, only: %i[update destroy]
      before_action { authorize(@vendor, :update?) }

      # POST /api/v1/vendors/:vendor_id/contacts  { contact: { name, role, phone, email } }
      def create
        contact = @vendor.contacts.create!(contact_params)
        render json: { data: VendorContactBlueprint.render_as_hash(contact) }, status: :created
      end

      def update
        @contact.update!(contact_params)
        render json: { data: VendorContactBlueprint.render_as_hash(@contact) }
      end

      def destroy
        @contact.destroy!
        head :no_content
      end

      private

      def set_vendor
        @vendor = current_organization.vendors.find(params[:vendor_id])
      end

      def set_contact
        @contact = @vendor.contacts.find(params[:id])
      end

      def contact_params
        params.expect(contact: %i[name role phone email])
      end
    end
  end
end
