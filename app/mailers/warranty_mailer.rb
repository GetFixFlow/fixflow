class WarrantyMailer < ApplicationMailer
  default from: ENV.fetch("MAILER_FROM", "noreply@fixflow.dev")

  def expiring(manager, assets)
    @manager = manager
    @assets  = assets
    @url     = "#{EmailSetup.base_url}/assets"
    mail(to: manager.email, subject: "[FixFlow] #{assets.size} #{'warranty'.pluralize(assets.size)} ending within 30 days")
  end
end
