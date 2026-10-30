# Preventive maintenance that follows a Meter: "every 250 running hours". The schedule keeps next_due_reading, the reading
# at which it falls due; when the meter reaches it a work order is made (if one is not already open) and the next due
# reading is the next one in the series above the meter's reading.
class PmMeterService
  def self.due?(schedule)
    schedule.freq_meter_based? && schedule.meter.present? && !schedule.next_due_reading.nil? &&
      schedule.meter.reading >= schedule.next_due_reading
  end

  # After a reading: make the work orders of the active schedules that follow this meter and have fallen due.
  def self.check(meter)
    schedules = meter.preventive_maintenances.status_active.freq_meter_based
    schedules.includes(:asset, :organization, :assigned_to, :meter).find_each do |schedule|
      generate_if_due(schedule)
    end
  end

  def self.generate_if_due(schedule)
    PmSchedulerService.generate_work_order(schedule) if PmSchedulerService.should_generate?(schedule)
  rescue StandardError => e
    Rails.logger.error "[PmMeterService] Failed for PM ##{schedule.id} (#{schedule.name}): #{e.message}"
    nil
  end

  # The reading at which the schedule falls due next, once a work order has been made for it. Made when it fell due, the
  # next one follows the fixed series (due, due + interval, ...), skipping any that were passed unserviced, so a missed
  # interval does not bring a second work order straight away. Made by hand before it was due, it counts from now.
  def self.next_due_reading_after_generating(schedule)
    return nil unless schedule.meter

    due = schedule.next_due_reading
    step = schedule.frequency_value
    current = schedule.meter.reading
    return current + step if due.nil? || current < due

    due + ((((current - due) / step).floor + 1) * step)
  end

  # The meter was replaced or reset: every schedule that follows it starts again, a full interval from the new reading.
  def self.rebase(meter)
    meter.preventive_maintenances.freq_meter_based.find_each do |schedule|
      schedule.update!(next_due_reading: meter.reading + schedule.frequency_value)
    end
  end
end
