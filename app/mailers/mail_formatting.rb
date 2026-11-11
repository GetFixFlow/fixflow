# Helpers for the text of emails, so a label, a date or a priority reads in the language the email is written in.
module MailFormatting
  # "Label:  value" lines with the values lined up, whatever the language's labels are.
  def mail_fields(pairs)
    width = pairs.keys.map { |label| label.to_s.length }.max.to_i + 1
    pairs.map { |label, value| "#{"#{label}:".ljust(width)} #{value}" }.join("\n")
  end

  def mail_priority(priority) = I18n.t("mail.priorities.#{priority}", default: priority.to_s).upcase

  def mail_role(role) = I18n.t("mail.roles.#{role}", default: role.to_s)

  # A day as "3 Nov 2026" (or "3 nov 2026") in the language of the email.
  def mail_day(date) = I18n.l(date.to_date, format: :mail_day)

  def mail_day_short(date) = I18n.l(date.to_date, format: :mail_day_short)
end
