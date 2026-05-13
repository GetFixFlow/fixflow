class WorkOrder < ApplicationRecord
  include AASM

  has_paper_trail only: %i[status assignee_id verified_by_id completed_at verified_at]

  # ─── Constants ─────────────────────────────────────────────────────────────

  PRIORITIES = %w[critical high medium low].freeze
  STATUSES   = %w[open assigned in_progress on_hold pending_parts completed verified cancelled].freeze

  # ─── Associations ──────────────────────────────────────────────────────────

  belongs_to :organization
  belongs_to :asset,                   optional: true
  belongs_to :preventive_maintenance,  optional: true
  belongs_to :assignee,     class_name: "User", optional: true
  belongs_to :requester,    class_name: "User", optional: true
  belongs_to :verified_by,  class_name: "User", optional: true
  has_many   :work_order_parts, dependent: :destroy
  has_many   :parts, through: :work_order_parts
  has_many   :comments,    as: :commentable, dependent: :destroy
  has_many   :attachments, dependent: :destroy
  has_many_attached :photos

  # ─── Validations ───────────────────────────────────────────────────────────

  validates :title, presence: true
  validates :priority, inclusion: { in: PRIORITIES }
  validates :status,   inclusion: { in: STATUSES }
  validates :completion_notes, presence: true, if: -> { completed? || verified? }
  validate  :assignee_belongs_to_same_org, if: :assignee_id
  validate  :verifier_is_not_assignee,     if: :verified_by_id

  # ─── Callbacks ─────────────────────────────────────────────────────────────

  before_create :generate_work_order_number

  # ─── State Machine (AASM) ──────────────────────────────────────────────────

  aasm column: :status, whiny_transitions: false do
    state :open, initial: true
    state :assigned
    state :in_progress
    state :on_hold
    state :pending_parts
    state :completed
    state :verified
    state :cancelled

    event :assign do
      transitions from: %i[open on_hold pending_parts in_progress], to: :assigned
      after { NotifyAssigneeJob.perform_later(id) }
    end

    event :start do
      transitions from: :assigned, to: :in_progress
      before { self.started_at ||= Time.current }
    end

    event :hold do
      transitions from: :in_progress, to: :on_hold
    end

    event :need_parts do
      transitions from: :in_progress, to: :pending_parts
    end

    event :resume do
      transitions from: %i[on_hold pending_parts], to: :in_progress
    end

    event :complete do
      transitions from: :in_progress, to: :completed, guard: :completion_notes_present?
      before { self.completed_at = Time.current }
      after  { NotifyManagerJob.perform_later(id) }
    end

    event :verify do
      transitions from: :completed, to: :verified, guard: :verifier_differs_from_assignee?
      before { self.verified_at = Time.current }
      after  { NotifyRequesterJob.perform_later(id) }
    end

    event :reject do
      transitions from: :completed, to: :in_progress
      before { self.completed_at = nil }
      after  { NotifyAssigneeJob.perform_later(id) }
    end

    event :cancel do
      transitions from: %i[open assigned in_progress on_hold pending_parts completed], to: :cancelled
    end
  end

  # ─── Scopes ────────────────────────────────────────────────────────────────

  scope :active,             ->            { where.not(status: %w[completed verified cancelled]) }
  scope :open,               ->            { where(status: %w[open assigned in_progress on_hold pending_parts]) }
  scope :by_status,          ->(s)         { where(status: Array(s)) }
  scope :by_priority,        ->(p)         { where(priority: Array(p)) }
  scope :by_assignee,        ->(uid)       { where(assignee_id: uid) }
  scope :by_asset,           ->(aid)       { where(asset_id: aid) }
  scope :assigned_to,        ->(uid)       { where(assignee_id: uid) }
  scope :unassigned,         ->            { where(assignee_id: nil) }
  scope :overdue,            ->            { open.where("due_date < ?", Time.current) }
  scope :search_by_keyword,  ->(q)         { where("title ILIKE :q OR description ILIKE :q", q: "%#{q}%") }
  scope :due_from,           ->(date)      { where("due_date >= ?", date) }
  scope :due_to,             ->(date)      { where("due_date <= ?", date) }

  private

  def generate_work_order_number
    return if work_order_number.present?
    last = self.class.unscoped
      .where("work_order_number LIKE 'WO-%'")
      .order(work_order_number: :desc)
      .pick(:work_order_number)
    seq = last ? last.delete_prefix("WO-").to_i + 1 : 1
    self.work_order_number = format("WO-%06d", seq)
  end

  def completion_notes_present?
    completion_notes.present?
  end

  def verifier_differs_from_assignee?
    verified_by_id != assignee_id || assignee_id.nil?
  end

  def assignee_belongs_to_same_org
    return unless assignee
    errors.add(:assignee, "must belong to the same organization") unless assignee.organization_id == organization_id
  end

  def verifier_is_not_assignee
    errors.add(:verified_by, "cannot verify their own work order") if verified_by_id == assignee_id
  end
end
