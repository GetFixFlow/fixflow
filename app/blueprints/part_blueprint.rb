class PartBlueprint < Blueprinter::Base
  identifier :id
  fields :name, :sku, :unit, :location_id, :organization_id, :created_at, :updated_at

  # Decimal columns are sent as numbers, not the strings Rails would use.
  field(:quantity_on_hand) { |part| part.quantity_on_hand.to_f }
  field(:reorder_point)    { |part| part.reorder_point.to_f }
  field(:unit_cost)        { |part| part.unit_cost&.to_f }
  field(:low_stock)        { |part| part.low_stock? }
end
