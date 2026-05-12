class Organization < ApplicationRecord
  has_many :users, dependent: :destroy
  has_many :locations, dependent: :destroy
  has_many :assets, dependent: :destroy
  has_many :work_orders, dependent: :destroy
  has_many :preventive_maintenances, dependent: :destroy
  has_many :parts, dependent: :destroy
  has_many :iot_rules, dependent: :destroy

  validates :name, presence: true
  validates :subdomain, presence: true, uniqueness: true,
    format: { with: /\A[a-z0-9\-]+\z/, message: "only lowercase letters, numbers, and hyphens" }

  store_accessor :settings, :timezone, :date_format, :work_order_prefix
end
