module PublicApi
  class PartBlueprint < Blueprinter::Base
    identifier :id

    fields :name, :sku, :unit, :custom_values, :created_at, :updated_at
    field(:quantity_on_hand) { |part| part.quantity_on_hand.to_f }
    field(:reorder_point) { |part| part.reorder_point.to_f }
    field(:unit_cost) { |part| part.unit_cost&.to_f }
    field(:low_stock, &:low_stock?)
    field(:location) { |part| part.location && { id: part.location.id, name: part.location.name } }
  end
end
