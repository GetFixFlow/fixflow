class PurchaseOrderLineBlueprint < Blueprinter::Base
  identifier :id
  fields :part_id

  field(:part_name)         { |line| line.part.name }
  field(:part_sku)          { |line| line.part.sku }
  field(:unit)              { |line| line.part.unit }
  field(:quantity)          { |line| line.quantity.to_f }
  field(:unit_cost)         { |line| line.unit_cost&.to_f }
  field(:quantity_received) { |line| line.quantity_received.to_f }
  field(:total)             { |line| line.total&.to_f }
end
