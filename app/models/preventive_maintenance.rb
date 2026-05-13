class PreventiveMaintenance < ApplicationRecord
  # ─── Enums ────────────────────────────────────────────────────────────────

  enum :frequency_type, {
    time_based:      0,
    meter_based:     1,
    calendar_based:  2,
    condition_based: 3
  }, prefix: :freq

  enum :priority, {
    critical: 0,
    high:     1,
    medium:   2,
    low:      3
  }, prefix: :priority

  enum :status, {
    active:   0,
    paused:   1,
    archived: 2
  }, prefix: :status

  FREQUENCY_UNITS = %w[days weeks months hours cycles].freeze

  # ─── Associations ──────────────────────────────────────────────────────────

  belongs_to :organization
  belongs_to :asset
  belongs_to :assigned_to, class_name: "User", optional: true
  has_many   :pm_executions, dependent: :destroy
  has_many   :work_orders, through: :pm_executions

  # ─── Validations ───────────────────────────────────────────────────────────

  validates :name,      presence: true
  validates :start_date, presence: true
  validates :template,  presence: true
  validate  :template_has_title
  validates :frequency_value,
    numericality: { only_integer: true, greater_than: 0 },
    if: -> { freq_time_based? || freq_meter_based? }
  validates :frequency_unit,
    inclusion: { in: FREQUENCY_UNITS },
    if: -> { freq_time_based? || freq_meter_based? }
  validate :end_date_after_start_date, if: :end_date
  validate :asset_belongs_to_same_org
  validate :assigned_to_belongs_to_same_org, if: :assigned_to_id

  # ─── Callbacks ─────────────────────────────────────────────────────────────

  after_save :recalculate_next_due, if: :scheduling_changed?

  # ─── Scopes ────────────────────────────────────────────────────────────────

  scope :active,   -> { where(status: :active) }
  scope :due,      -> { active.where("next_due_at <= ?", Time.current + 24.hours) }
  scope :overdue,  -> { active.where("next_due_at < ?", Time.current) }
  scope :due_within, ->(days) { active.where(next_due_at: ..days.days.from_now) }

  private

  def scheduling_changed?
    saved_change_to_frequency_type? || saved_change_to_frequency_value? ||
      saved_change_to_frequency_unit? || saved_change_to_start_date?
  end

  def recalculate_next_due
    next_date = PmSchedulerService.calculate_next_due(self)
    update_column(:next_due_at, next_date) if next_date
  end

  def template_has_title
    errors.add(:template, "must have a title key") unless template.is_a?(Hash) && template["title"].present?
  end

  def end_date_after_start_date
    return unless start_date
    errors.add(:end_date, "must be after start_date") if end_date <= start_date
  end

  def asset_belongs_to_same_org
    return unless asset
    errors.add(:asset, "must belong to the same organization") unless asset.organization_id == organization_id
  end

  def assigned_to_belongs_to_same_org
    return unless assigned_to
    errors.add(:assigned_to, "must belong to the same organization") unless assigned_to.organization_id == organization_id
  end
end
