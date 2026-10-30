class PreventiveMaintenance < ApplicationRecord
  include Auditable

  acts_as_tenant :organization
  # The scheduler moves the due date and the counters on; only a person's edits are worth a line.
  audited ignore: %w[next_due_at next_due_reading last_run_at times_generated times_completed times_skipped]

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

  # For a meter-based schedule: the meter's reading when the machine was last serviced, if that is not the reading now.
  # The schedule then falls due one interval after it.
  attr_accessor :last_service_reading

  # ─── Associations ──────────────────────────────────────────────────────────

  belongs_to :organization
  belongs_to :asset
  # The meter a meter-based schedule follows, and the reading it falls due at (next_due_reading).
  belongs_to :meter, optional: true
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
    if: :freq_time_based?
  # A new schedule (or one changed to follow a meter) must name the meter; ones made before meters existed keep working.
  validates :meter, presence: true, if: -> { freq_meter_based? && (new_record? || will_save_change_to_frequency_type?) }
  validate :meter_belongs_to_the_asset
  validates :last_service_reading, numericality: { greater_than_or_equal_to: 0, less_than: 10**12 }, allow_blank: true
  validate :end_date_after_start_date, if: :end_date
  validate :asset_belongs_to_same_org
  validate :assigned_to_belongs_to_same_org, if: :assigned_to_id

  # ─── Callbacks ─────────────────────────────────────────────────────────────

  before_validation :follow_meter_unit
  before_save :set_next_due_reading
  after_save :recalculate_next_due, if: :scheduling_changed?

  # ─── Scopes ────────────────────────────────────────────────────────────────

  scope :active,   -> { where(status: :active) }
  scope :due,      -> { active.where("next_due_at <= ?", Time.current + 24.hours) }
  scope :overdue,  -> { active.where("next_due_at < ?", Time.current) }
  scope :due_within, ->(days) { active.where(next_due_at: ..days.days.from_now) }

  private

  # The schedule counts in the meter's unit ("250 km"), whatever was sent.
  def follow_meter_unit
    if freq_meter_based? && meter
      self.frequency_unit = meter.unit
    elsif !freq_meter_based?
      self.meter = nil
      self.next_due_reading = nil
    end
  end

  # Counts from the last service (or from now) when the schedule is made, follows a different meter, or has a new interval.
  def set_next_due_reading
    return unless freq_meter_based? && meter
    return unless new_record? || last_service_reading.present? || will_save_change_to_meter_id? ||
                  will_save_change_to_frequency_type? || will_save_change_to_frequency_value?

    self.next_due_reading = meter_baseline + frequency_value
  end

  # Where the counting starts: the last service if we were told, the current start if only the interval changed, else now.
  def meter_baseline
    return BigDecimal(last_service_reading.to_s) if last_service_reading.present?
    return meter.reading if new_record? || will_save_change_to_meter_id? || will_save_change_to_frequency_type? || next_due_reading.nil?

    next_due_reading - (frequency_value_was || frequency_value)
  end

  def meter_belongs_to_the_asset
    return unless meter && (meter.asset_id != asset_id || meter.organization_id != organization_id)

    errors.add(:meter, "must be a meter of the same asset")
  end

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
