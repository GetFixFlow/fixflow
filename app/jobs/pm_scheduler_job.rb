class PmSchedulerJob < ApplicationJob
  queue_as :scheduled

  def perform
    generated = 0
    skipped   = 0
    errors    = 0

    due_pms = PreventiveMaintenance
      .status_active
      .where("next_due_at <= ?", Time.current + 24.hours)
      .includes(:organization, :asset, :assigned_to)

    due_pms.each do |pm|
      if PmSchedulerService.should_generate?(pm)
        PmSchedulerService.generate_work_order(pm)
        generated += 1
      else
        skipped += 1
      end
    rescue => e
      errors += 1
      Rails.logger.error "[PmSchedulerJob] Failed for PM ##{pm.id} (#{pm.name}): #{e.message}"
    end

    Rails.logger.info "[PmSchedulerJob] Done — generated: #{generated}, skipped: #{skipped}, errors: #{errors}"
  end
end
