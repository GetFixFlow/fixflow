# A person to call at a vendor.
class VendorContact < ApplicationRecord
  belongs_to :vendor

  normalizes :name, :role, :phone, :email, with: ->(text) { text.to_s.strip.presence }

  validates :name, presence: true, length: { maximum: 120 }
  validates :role, length: { maximum: 80 }
  validates :phone, length: { maximum: 40 }
  validates :email, format: { with: URI::MailTo::EMAIL_REGEXP }, length: { maximum: 255 }, allow_nil: true
end
