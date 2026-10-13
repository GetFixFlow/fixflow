class Part < ApplicationRecord
  class InsufficientStock < ArgumentError; end

  acts_as_tenant :organization
  belongs_to :organization
  belongs_to :location, optional: true
  has_many :work_order_parts, dependent: :destroy
  has_many :work_orders, through: :work_order_parts

  before_validation { self.sku = sku.presence&.strip }
  before_destroy :ensure_never_used, prepend: true

  validates :name, presence: true
  validates :sku, uniqueness: { scope: :organization_id, case_sensitive: false },
                  allow_nil: true
  validates :unit_cost, numericality: { greater_than_or_equal_to: 0 }, allow_nil: true
  validates :quantity_on_hand, numericality: { greater_than_or_equal_to: 0 }
  validates :reorder_point, numericality: { greater_than_or_equal_to: 0 }

  scope :low_stock, -> { where("quantity_on_hand <= reorder_point") }
  scope :out_of_stock, -> { where(quantity_on_hand: 0) }

  def low_stock?
    quantity_on_hand <= reorder_point
  end

  # Under a row lock: two technicians taking the last of a part at once cannot both succeed.
  def adjust_stock(quantity, direction: :add)
    with_lock do
      delta   = direction == :add ? quantity.abs : -quantity.abs
      new_qty = quantity_on_hand + delta
      raise InsufficientStock, "Only #{quantity_on_hand.to_f.round(2)} #{unit} of #{name} in stock." if new_qty.negative?

      update!(quantity_on_hand: new_qty)
    end
  end

  private

  # Deleting a used part would delete its lines from every work order and quietly change their cost.
  def ensure_never_used
    return unless work_order_parts.exists?

    errors.add(:base, "#{name} has been used on work orders, so it cannot be deleted. Set its stock to 0 instead.")
    throw :abort
  end
end
