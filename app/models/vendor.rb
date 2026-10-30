# An outside company that does maintenance work (a contractor, a repair shop, a hire firm). A work order can be
# assigned to one and carries what they charged, which the cost reports add up.
class Vendor < ApplicationRecord
  include Auditable

  acts_as_tenant :organization
  audited

  belongs_to :organization
  has_many :contacts, class_name: "VendorContact", dependent: :destroy
  has_many :work_orders, dependent: :restrict_with_error

  normalizes :name, :category, :phone, :email, :website, with: ->(text) { text.to_s.strip.presence }

  validates :name, presence: true, length: { maximum: 120 }, uniqueness: { scope: :organization_id, case_sensitive: false }
  validates :category, length: { maximum: 80 }
  validates :phone, length: { maximum: 40 }
  validates :email, format: { with: URI::MailTo::EMAIL_REGEXP }, length: { maximum: 255 }, allow_nil: true
  validates :website, length: { maximum: 255 }
  validates :address, :notes, length: { maximum: 2_000 }

  scope :active, -> { where(active: true) }
end
