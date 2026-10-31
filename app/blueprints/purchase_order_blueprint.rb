class PurchaseOrderBlueprint < Blueprinter::Base
  identifier :id
  fields :number, :status, :vendor_id, :reason, :rejection_reason, :notes, :supplier_reference, :expected_on,
         :decided_at, :ordered_at, :received_at, :created_at, :updated_at

  field(:vendor)       { |order| order.vendor && { id: order.vendor.id, name: order.vendor.name } }
  field(:requested_by) { |order| order.requested_by && { id: order.requested_by.id, name: order.requested_by.full_name } }
  field(:decided_by)   { |order| order.decided_by && { id: order.decided_by.id, name: order.decided_by.full_name } }
  field(:line_count)   { |order| order.lines.size }
  field(:total)        { |order| order.total.to_f }
  field(:editable, &:editable?)

  view :extended do
    association :lines, blueprint: PurchaseOrderLineBlueprint
  end
end
