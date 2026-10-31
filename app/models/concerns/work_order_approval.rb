# Work above the company's approval limit (Settings, Organization) needs a manager's approval before it is started, and
# again before it is completed if its cost has grown past what was approved.
#
# The cost is what the work is expected to come to: the parts used, what a vendor charges, and the labor, which is the
# hours recorded once there are any and until then the estimate, at the assignee's rate or else the company's. Work with
# no estimate, no parts and no vendor charge is expected to cost nothing, so an estimate is what makes this work.
module WorkOrderApproval
  extend ActiveSupport::Concern

  included do
    belongs_to :approved_by, class_name: "User", optional: true
  end

  def expected_cost
    rate = assignee&.hourly_rate || organization.default_labor_rate
    labor = actual_hours.present? ? labor_cost.to_d : estimated_hours.to_d * rate
    (parts_cost.to_d + vendor_cost.to_d + labor).round(2)
  end

  delegate :approval_limit, to: :organization

  # Over the limit, and not approved at this cost or a higher one.
  def approval_needed?
    limit = approval_limit
    return false unless limit.positive?

    cost = expected_cost
    cost > limit && (approved_cost.nil? || cost > approved_cost)
  end

  # An approver is never the person doing the work, as with verifying.
  def approvable_by?(user) = user.manager_or_above? && assignee_id != user.id

  def approve!(by:)
    update!(approved_by: by, approved_at: Time.current, approved_cost: expected_cost, approval_requested_at: nil)
    log_activity("approved")
  end

  # Tells the managers, once: asking again (every tap of Start) does not send it again until it has been approved.
  def request_approval!
    return if approval_requested_at.present?

    update!(approval_requested_at: Time.current)
    ApprovalRequestedJob.perform_later(id)
  end
end
