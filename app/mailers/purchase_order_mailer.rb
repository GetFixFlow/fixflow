class PurchaseOrderMailer < ApplicationMailer
  default from: ENV.fetch("MAILER_FROM", "noreply@fixflow.dev")

  def requested(manager, order)
    @manager = manager
    @order   = order
    @url     = "#{EmailSetup.base_url}/purchasing"
    mail(to: manager.email, subject: "[FixFlow] Parts requested: #{order.number}")
  end
end
