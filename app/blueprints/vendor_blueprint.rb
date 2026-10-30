class VendorBlueprint < Blueprinter::Base
  identifier :id
  fields :name, :category, :phone, :email, :website, :address, :notes, :active, :created_at, :updated_at

  field(:work_orders_count) { |vendor, options| options.dig(:counts, vendor.id) || 0 }

  view :extended do
    association :contacts, blueprint: VendorContactBlueprint do |vendor, _options|
      vendor.contacts.order(:id)
    end
  end
end
