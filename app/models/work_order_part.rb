class WorkOrderPart < ApplicationRecord
  belongs_to :work_order
  belongs_to :part

  validates :quantity_used, numericality: { only_integer: true, greater_than: 0 }
  validates :unit_cost, numericality: { greater_than_or_equal_to: 0 }, allow_nil: true
end
