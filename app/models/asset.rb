class Asset < ApplicationRecord
  include Discard::Model

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

  validates :name, presence: true
  validates :status, inclusion: { in: STATUSES }

  before_create :generate_asset_tag

  scope :by_status,             ->(status)      { where(status: status) }
  scope :by_location,           ->(location_id) { where(location_id: location_id) }
  scope :search_by_name_or_tag, ->(query)       { where("name ILIKE :q OR asset_tag ILIKE :q", q: "%#{query}%") }
  scope :operational,           ->              { where(status: "operational") }
  scope :needs_attention,       ->              { where(status: %w[degraded down]) }

  private

  def generate_asset_tag
    return if asset_tag.present?
    last_tag = self.class.unscoped
      .where("asset_tag LIKE 'FF-%'")
      .order(asset_tag: :desc)
      .pick(:asset_tag)
    seq = last_tag ? last_tag.delete_prefix("FF-").to_i + 1 : 1
    self.asset_tag = format("FF-%06d", seq)
  end
end
