class PmSchedulerJob < ApplicationJob
  queue_as :scheduled

  def perform
    due_pms = PreventiveMaintenance.due.includes(:organization, :asset)
    due_pms.each { |pm| PmWorkOrderGeneratorJob.perform_later(pm.id) }
    Rails.logger.info "[PmSchedulerJob] Triggered #{due_pms.count} PM work orders"
  end
end
