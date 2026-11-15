# A reading far outside what that sensor usually reads, flagged by Iot::AnomalyDetector without anyone setting a limit.
# It is a flag for a person to look at, not an alarm: nothing is created from it, and a person can say it is nothing.
class SensorAnomaly < ApplicationRecord
  enum :status, { open: 0, acknowledged: 1, dismissed: 2 }, default: :open

  acts_as_tenant :organization
  belongs_to :organization
  belongs_to :asset
  belongs_to :acknowledged_by, class_name: "User", optional: true

  class InvalidTransition < StandardError; end

  validates :metric_name, presence: true
  validates :value, :usual_low, :usual_high, :usual_middle, :score, numericality: true
  validates :baseline_count, numericality: { only_integer: true, greater_than: 0 }

  scope :recent, -> { order(created_at: :desc) }
  scope :for_asset, ->(asset_id) { where(asset_id: asset_id) }

  # One line for lists and chat, for example "temperature reads 91.2 °C; it is usually 62 to 74 °C".
  def message
    "#{metric_name} reads #{with_unit(value)}; it is usually #{number(usual_low)} to #{with_unit(usual_high)}"
  end

  # Someone has looked at it and it is real. Only an open flag can be acknowledged.
  def acknowledge!(by:, notes: nil)
    move!(%w[open], :acknowledged, by: by, notes: notes)
  end

  # Someone has looked at it and it is nothing. An open or acknowledged flag can be.
  def dismiss!(by:, notes: nil)
    move!(%w[open acknowledged], :dismissed, by: by, notes: notes)
  end

  private

  def move!(allowed, to, by:, notes:)
    unless allowed.include?(status)
      raise InvalidTransition, status == to.to_s ? "This flag is already #{status}" : "This flag is #{status}, so it cannot be #{to}"
    end

    update!(status: to, acknowledged_by: by, acknowledged_at: Time.current, notes: notes.presence || self.notes)
  end

  def with_unit(amount) = [number(amount), unit.presence].compact.join(" ")

  # 85.0 shows as 85 and 91.25 as 91.25.
  def number(amount) = amount.to_d.to_s("F").sub(/\.0\z/, "")
end
