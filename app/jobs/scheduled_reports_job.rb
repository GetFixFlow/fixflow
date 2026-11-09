# Every hour: emails the saved reports whose day it is. A report goes out on its weekday from 7 in the morning,
# company time, once that day (saved_reports.last_sent_on remembers the date). A failure is kept on the report
# (last_error) and tried again the next hour of the same day; a report is never sent twice, and one missed because the
# server was down all day waits for the next week.
class ScheduledReportsJob < ApplicationJob
  queue_as :scheduled

  SEND_HOUR = 7

  def perform(now = Time.current)
    due(now).each { |saved, today| send_report(saved, today) }
  end

  private

  def due(now)
    reports = ActsAsTenant.without_tenant { SavedReport.emailed.includes(:organization, :user).to_a }
    reports.filter_map do |saved|
      local = now.in_time_zone(saved.organization.timezone_or_default)
      [saved, local.to_date] if local.wday == saved.send_on && local.hour >= SEND_HOUR && saved.last_sent_on != local.to_date
    end
  end

  def send_report(saved, today)
    ActsAsTenant.with_tenant(saved.organization) do
      people = saved.people_to_email.to_a
      return finish(saved, today, "Nobody to send it to: the people chosen are no longer managers, or turned it off.") if people.empty?

      result = SavedReportRun.new(saved, today: today).call
      failed = people.reject { |person| deliver(saved, person, result) }
      # One bad mailbox must not stop the others or send them a second copy next hour: it is sent if anyone got it.
      raise "No email could be delivered: #{failed.map(&:email).join(', ')}" if failed.size == people.size

      ActivityLogService.log(action: "saved_report.sent", resource: saved, user: nil,
metadata: { recipients: people.size - failed.size })
      finish(saved, today, failed.empty? ? nil : "Could not email #{failed.map(&:email).join(', ')}.")
    end
  rescue StandardError => e
    Rails.logger.error "[SavedReport] #{saved.id} could not be sent: #{e.class} — #{e.message}"
    saved.update_columns(last_error: "#{e.class.name.demodulize}: #{e.message}".first(500)) # rubocop:disable Rails/SkipsModelValidations -- bookkeeping
  end

  def deliver(saved, person, result)
    ReportMailer.scheduled(person, saved, result).deliver_now
    true
  rescue StandardError => e
    Rails.logger.error "[SavedReport] #{saved.id} could not be emailed to user #{person.id}: #{e.class} — #{e.message}"
    false
  end

  def finish(saved, today, error)
    saved.update!(last_sent_on: today, last_sent_at: Time.current, last_error: error)
  end
end
