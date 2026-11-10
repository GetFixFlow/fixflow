class WarrantyMailer < ApplicationMailer
  default from: ENV.fetch("MAILER_FROM", "noreply@fixflow.dev")

  def expiring(manager, assets)
    @manager = manager
    @assets  = assets
    @url     = "#{EmailSetup.base_url}/assets"
    in_language_of(manager) { mail(to: manager.email, subject: t(".subject", count: assets.size)) }
  end
end
