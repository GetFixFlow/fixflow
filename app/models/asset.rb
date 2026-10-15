class Asset < ApplicationRecord
  include Discard::Model
  acts_as_tenant :organization

  STATUSES = %w[operational degraded down decommissioned].freeze

  belongs_to :organization
  belongs_to :location, optional: true
  has_many :work_orders, dependent: :nullify
  has_many :preventive_maintenances, dependent: :destroy
  has_many :sensor_readings,   dependent: :destroy
  has_many :sensor_aggregates, dependent: :destroy
  has_many :iot_rules,         dependent: :destroy
  has_many :iot_alerts,        dependent: :destroy
  has_many_attached :photos
  has_many_attached :documents

  validates :name, presence: true
  validates :status, inclusion: { in: STATUSES }

  # The random code printed in the QR label's link (see PublicWorkRequest).
  has_secure_token :public_code, length: 24

  before_create :generate_asset_tag

  scope :by_status,             ->(status)      { where(status: status) }
  scope :by_location,           ->(location_id) { where(location_id: location_id) }
  scope :search_by_name_or_tag, lambda { |query|
    where("name ILIKE :q OR asset_tag ILIKE :q OR public_code = :exact", q: "%#{query}%", exact: query)
  }
  scope :operational,           ->              { where(status: "operational") }
  scope :needs_attention,       ->              { where(status: %w[degraded down]) }

  private

  def generate_asset_tag
    return if asset_tag.present?
    last_tag = ActsAsTenant.without_tenant do
      self.class.unscoped.where("asset_tag LIKE 'FF-%'").order(asset_tag: :desc).pick(:asset_tag)
    end
    seq = last_tag ? last_tag.delete_prefix("FF-").to_i + 1 : 1
    self.asset_tag = format("FF-%06d", seq)
  end
end
