class Part < ApplicationRecord
  acts_as_tenant :organization
  belongs_to :organization
  belongs_to :location, optional: true
  has_many :work_order_parts, dependent: :destroy
  has_many :work_orders, through: :work_order_parts

  validates :name, presence: true
  validates :quantity_on_hand, numericality: { greater_than_or_equal_to: 0 }
  validates :reorder_point, numericality: { greater_than_or_equal_to: 0 }

  scope :low_stock, -> { where("quantity_on_hand <= reorder_point") }
  scope :out_of_stock, -> { where(quantity_on_hand: 0) }

  def low_stock?
    quantity_on_hand <= reorder_point
  end

  def adjust_stock(quantity, direction: :add)
    delta = direction == :add ? quantity.abs : -quantity.abs
    new_qty = quantity_on_hand + delta
    raise ArgumentError, "Insufficient stock" if new_qty < 0
    update!(quantity_on_hand: new_qty)
  end
end
