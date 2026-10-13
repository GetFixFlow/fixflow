class PartMailer < ApplicationMailer
  default from: ENV.fetch("MAILER_FROM", "noreply@fixflow.dev")

  def low_stock(manager, part, kind)
    @manager = manager
    @part    = part
    @out     = kind.to_s == "out"
    @url     = "#{EmailSetup.base_url}/parts"
    mail(
      to:      manager.email,
      subject: "[FixFlow] #{@out ? 'Out of stock' : 'Running low'}: #{part.name}"
    )
  end
end
