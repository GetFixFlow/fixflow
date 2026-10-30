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

    # Schedules that follow a meter are made due by a reading (see MeterReadingRecorder); this catches any that were missed.
    meter_pms = PreventiveMaintenance.status_active.freq_meter_based.includes(:organization, :asset, :assigned_to, :meter)

    (due_pms.to_a + meter_pms.to_a).uniq.each do |pm|
      if PmSchedulerService.should_generate?(pm)
        PmSchedulerService.generate_work_order(pm)
        generated += 1
      elsif !pm.freq_meter_based? # a meter schedule that is not due yet is the normal case, not a skip
        skipped += 1
      end
    rescue => e
      errors += 1
      Rails.logger.error "[PmSchedulerJob] Failed for PM ##{pm.id} (#{pm.name}): #{e.message}"
    end

    Rails.logger.info "[PmSchedulerJob] Done — generated: #{generated}, skipped: #{skipped}, errors: #{errors}"
  end
end
