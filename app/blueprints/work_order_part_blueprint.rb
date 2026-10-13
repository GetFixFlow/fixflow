class WorkOrderPartBlueprint < Blueprinter::Base
  identifier :id
  fields :part_id, :quantity_used, :unit_cost

  field(:name) { |line| line.part.name }
  field(:sku)  { |line| line.part.sku }
end
