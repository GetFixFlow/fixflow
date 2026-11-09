class ReportMailer < ApplicationMailer
  default from: ENV.fetch("MAILER_FROM", "noreply@fixflow.dev")

  # A saved report as a PDF. `result` is a SavedReportRun::Result.
  def scheduled(person, saved_report, result)
    @person = person
    @report = saved_report
    @result = result
    @url    = "#{EmailSetup.base_url}/reports/saved"
    attachments[result.filename] = { mime_type: "application/pdf", content: result.pdf }
    mail(to: person.email,
subject: "[FixFlow] #{saved_report.name}: #{result.from.strftime('%-d %b')} to #{result.to.strftime('%-d %b %Y')}")
  end
end
