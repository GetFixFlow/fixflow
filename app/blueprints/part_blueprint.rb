class PartBlueprint < Blueprinter::Base
  identifier :id
  fields :name, :sku, :quantity_on_hand, :reorder_point, :unit,
    :location_id, :organization_id, :created_at, :updated_at
  field(:low_stock) { |part| part.low_stock? }
end
