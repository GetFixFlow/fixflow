class PurchaseOrderMailer < ApplicationMailer
  default from: ENV.fetch("MAILER_FROM", "noreply@fixflow.dev")

  def requested(manager, order)
    @manager = manager
    @order   = order
    @url     = "#{EmailSetup.base_url}/purchasing"
    in_language_of(manager) { mail(to: manager.email, subject: t(".subject", number: order.number)) }
  end
end
