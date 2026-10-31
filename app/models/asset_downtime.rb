# A time an asset was out of action: from started_at to ended_at, or to now while it still is (ended_at empty).
#
# An asset whose status is "down" has an open one. It is opened and closed by the status (see Asset), or by hand for
# a stop that nobody recorded at the time; the dates can be corrected afterwards.
class AssetDowntime < ApplicationRecord
  include Auditable

  acts_as_tenant :organization
  audited watch: %w[started_at ended_at reason]

  # Clocks differ a little; a time this far ahead of ours is still "now".
  CLOCK_SKEW = 5.minutes

  # Set when the asset's status opens or closes the record: the asset's own line in the log already says its status
  # changed, so a second line for the same thing is left out. A person's edit of a record is always written.
  attr_accessor :unaudited

  belongs_to :organization
  belongs_to :asset
  belongs_to :started_by, class_name: "User", optional: true
  belongs_to :ended_by, class_name: "User", optional: true

  normalizes :reason, with: ->(text) { text.to_s.strip.presence }

  validates :started_at, presence: true
  validates :reason, length: { maximum: 200 }
  validate :asset_belongs_to_same_org
  validate :ends_after_it_starts
  validate :not_in_the_future
  validate :must_not_overlap_another

  scope :open, -> { where(ended_at: nil) }
  # Any that was going on at some point of the period (the period's end is never later than now).
  scope :during, ->(from, to) { where(started_at: ...to).where("ended_at IS NULL OR ended_at > ?", from) }
  scope :newest_first, -> { order(started_at: :desc, id: :desc) }

  # The audit log names the asset it happened to.
  def audit_name = asset&.name

  def open? = ended_at.nil?

  # Hours of it that fall inside the period, to now if it is still going on.
  def hours_within(from, to, now: Time.current)
    first = [started_at, from].max
    last = [ended_at || now, to].min
    last > first ? (last - first) / 1.hour : 0.0
  end

  private

  def audit(...) = (super unless unaudited)

  def asset_belongs_to_same_org
    errors.add(:asset, "must belong to the same organization") if asset && asset.organization_id != organization_id
  end

  def ends_after_it_starts
    errors.add(:ended_at, "must not be before it started") if started_at && ended_at && ended_at < started_at
  end

  def not_in_the_future
    limit = Time.current + CLOCK_SKEW
    errors.add(:started_at, "cannot be in the future") if started_at && started_at > limit
    errors.add(:ended_at, "cannot be in the future") if ended_at && ended_at > limit
  end

  def must_not_overlap_another
    return unless started_at && asset_id

    others = self.class.unscoped.where(asset_id: asset_id).where.not(id: id).where("ended_at IS NULL OR ended_at > ?", started_at)
    others = others.where(started_at: ...ended_at) if ended_at
    errors.add(:base, "That overlaps another time this asset was down") if others.exists?
  end
end
