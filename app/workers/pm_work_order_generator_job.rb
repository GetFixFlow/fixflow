class PmWorkOrderGeneratorJob < ApplicationJob
  queue_as :default

  def perform(pm_id)
    pm = PreventiveMaintenance.find(pm_id)
    return unless pm.active?

    WorkOrder.create!(
      organization: pm.organization,
      asset: pm.asset,
      title: "PM: #{pm.name}",
      description: "Scheduled preventive maintenance",
      priority: "medium",
      status: "open",
      due_date: pm.next_due_at,
      checklist: pm.template["checklist"] || []
    )

    pm.update!(
      last_run_at: Time.current,
      next_due_at: pm.calculate_next_due
    )
  end
end
