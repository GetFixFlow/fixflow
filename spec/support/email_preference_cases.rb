# One entry per email the app sends about work: who gets it, how to make the app send it, and what its
# subject says. Used by spec/jobs/email_preferences_in_jobs_spec.rb.
module EmailPreferenceCases
  ALL = [
    { event: "wo_assigned", role: "technician", subject: /Work Order Assigned/,
      setup: lambda { |org, person|
        id = create(:work_order, :assigned, organization: org, assignee: person).id
        -> { NotifyAssigneeJob.perform_now(id) }
      } },
    { event: "wo_verified", role: "requester", subject: /Maintenance Request Has Been Completed|Work Order Completed/,
      setup: lambda { |org, person|
        id = create(:work_order, organization: org, requester: person).id
        -> { NotifyRequesterJob.perform_now(id) }
      } },
    { event: "wo_needs_verification", role: "manager", subject: /Ready for Verification/,
      setup: lambda { |org, _person|
        id = create(:work_order, organization: org).id
        -> { NotifyManagerJob.perform_now(id) }
      } },
    { event: "wo_new_request", role: "manager", subject: /New Maintenance Request/,
      setup: lambda { |org, _person|
        id = create(:work_order, organization: org).id
        -> { NotifyNewRequestJob.perform_now(id) }
      } },
    { event: "part_low_stock", role: "manager", subject: /Running low|Out of stock/,
      setup: lambda { |org, _person|
        id = create(:part, organization: org).id
        -> { LowStockAlertJob.perform_now(id, "low") }
      } },
    { event: "pm_overdue", role: "manager", subject: /Overdue PM/,
      setup: lambda { |org, _person|
        create(:preventive_maintenance, :overdue_pm, organization: org)
        -> { PmOverdueNotificationJob.perform_now }
      } },
    { event: "pm_due_soon", role: "manager", subject: /Due This Week/, label: "pm_due_soon (to managers)",
      setup: lambda { |org, _person|
        create(:preventive_maintenance, :active_pm, organization: org)
        -> { PmDueSoonNotificationJob.perform_now }
      } },
    { event: "pm_due_soon", role: "technician", subject: /Due This Week/, label: "pm_due_soon (to the assigned technician)",
      setup: lambda { |org, person|
        create(:preventive_maintenance, :active_pm, organization: org, assigned_to: person)
        -> { PmDueSoonNotificationJob.perform_now }
      } },
    { event: "pm_generated", role: "technician", subject: /PM Work Order Auto-Generated/,
      setup: lambda { |org, person|
        create(:preventive_maintenance, :active_pm, organization: org, assigned_to: person, next_due_at: Time.current)
        -> { PmSchedulerJob.perform_now }
      } }
  ].freeze
end
