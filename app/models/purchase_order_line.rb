# One part on a purchase order: how many are wanted, what each costs, and how many have come in so far.
class PurchaseOrderLine < ApplicationRecord
  belongs_to :purchase_order
  belongs_to :part

  validates :quantity, numericality: { greater_than: 0, less_than: 10**8 }
  validates :unit_cost, numericality: { greater_than_or_equal_to: 0, less_than: 10**8 }, allow_nil: true
  validates :quantity_received, numericality: { greater_than_or_equal_to: 0 }
  validate  :part_belongs_to_same_org

  def outstanding = [quantity - quantity_received, 0].max

  def total = unit_cost && (quantity * unit_cost)

  private

  # The part is looked up past the tenant scope: another company's part would otherwise read as no part, and pass.
  def part_belongs_to_same_org
    return unless part_id && purchase_order

    ours = Part.unscoped.exists?(id: part_id, organization_id: purchase_order.organization_id)
    errors.add(:part, "must belong to the same organization") unless ours
  end
end
