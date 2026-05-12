class PmWorkOrderGeneratorJob < ApplicationJob
  queue_as :default

  def perform(pm_id)
    pm = PreventiveMaintenance.find_by(id: pm_id)
    return unless pm&.active?

    WorkOrder.create!(
      organization: pm.organization,
      asset: pm.asset,
      title: pm.template&.dig("title").presence || "PM: #{pm.name}",
      description: pm.template&.dig("description").presence || "Preventive maintenance — #{pm.name}",
      priority: pm.template&.dig("priority").presence || "medium",
      status: "open"
    )

    pm.update!(
      last_run_at: Time.current,
      next_due_at: pm.calculate_next_due
    )
  end
end
