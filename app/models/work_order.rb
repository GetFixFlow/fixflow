class WorkOrder < ApplicationRecord
  PRIORITIES = %w[critical high medium low].freeze
  STATUSES   = %w[open in_progress pending_parts completed verified].freeze

  belongs_to :organization
  belongs_to :asset, optional: true
  belongs_to :assignee, class_name: "User", optional: true
  belongs_to :requester, class_name: "User", optional: true
  has_many_attached :photos

  validates :title, presence: true
  validates :priority, inclusion: { in: PRIORITIES }
  validates :status, inclusion: { in: STATUSES }

  before_update :set_completed_at

  scope :open, -> { where(status: %w[open in_progress pending_parts]) }
  scope :overdue, -> { open.where("due_date < ?", Time.current) }
  scope :by_priority, ->(p) { where(priority: p) }
  scope :unassigned, -> { where(assignee_id: nil) }

  private

  def set_completed_at
    if status_changed? && status.in?(%w[completed verified]) && completed_at.nil?
      self.completed_at = Time.current
    end
  end
end
