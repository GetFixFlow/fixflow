class ReportMailer < ApplicationMailer
  default from: ENV.fetch("MAILER_FROM", "noreply@fixflow.dev")

  # A saved report as a PDF. `result` is a SavedReportRun::Result.
  def scheduled(person, saved_report, result)
    @person = person
    @report = saved_report
    @result = result
    @url    = "#{EmailSetup.base_url}/reports/saved"
    attachments[result.filename] = { mime_type: "application/pdf", content: result.pdf }
    in_language_of(person) do
      mail(to: person.email,
           subject: t(".subject", name: saved_report.name, from: mail_day_short(result.from), to: mail_day(result.to)))
    end
  end
end
