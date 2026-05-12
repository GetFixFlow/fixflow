class IotRule < ApplicationRecord
  OPERATORS  = %w[gt gte lt lte eq neq].freeze
  PRIORITIES = WorkOrder::PRIORITIES

  belongs_to :asset
  belongs_to :organization

  validates :name, presence: true
  validates :metric_name, presence: true
  validates :operator, inclusion: { in: OPERATORS }
  validates :threshold, numericality: true
  validates :priority, inclusion: { in: PRIORITIES }
  validates :cooldown_minutes, numericality: { greater_than_or_equal_to: 0 }

  scope :active, -> { where(active: true) }
  scope :for_asset, ->(asset_id) { where(asset_id: asset_id) }

  def triggered_by?(reading_value)
    case operator
    when "gt"  then reading_value > threshold
    when "gte" then reading_value >= threshold
    when "lt"  then reading_value < threshold
    when "lte" then reading_value <= threshold
    when "eq"  then reading_value == threshold
    when "neq" then reading_value != threshold
    end
  end

  def work_order_title_for(reading_value)
    template = work_order_title_template.presence || "#{asset.name}: #{metric_name} alert (#{reading_value} #{threshold})"
    template.gsub("{asset}", asset.name)
            .gsub("{metric}", metric_name)
            .gsub("{value}", reading_value.to_s)
  end
end
