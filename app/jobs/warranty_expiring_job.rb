# Once a day: tells each company's managers and administrators which warranties end within the next 30 days. Each
# end date is announced once (assets.warranty_alerted_on remembers it), so a warranty is not repeated every morning,
# but a date that is changed is announced again, and so is one the job missed on a day it was not running.
class WarrantyExpiringJob < ApplicationJob
  queue_as :notifications

  WARNING_DAYS = 30

  def perform
    assets = ActsAsTenant.without_tenant do
      Asset.kept.warranty_ending_within(WARNING_DAYS).includes(:organization).order(:warranty_expires_on, :name).to_a
    end
    assets.group_by(&:organization).each { |organization, ending| tell(organization, ending) }
  end

  private

  def tell(organization, assets)
    title = "#{assets.size} #{'warranty'.pluralize(assets.size)} ending soon"
    body = assets.first(3).map { |asset| "#{asset.name} (#{asset.warranty_expires_on.iso8601})" }.join(", ")
    body += " and #{assets.size - 3} more" if assets.size > 3
    ChatNotifier.post(organization, "warranty_expiring", title: title, body: body, path: "/assets")
    organization.users.managers.wanting_email("warranty_expiring").each do |manager|
      WarrantyMailer.expiring(manager, assets).deliver_later
    end
    # Marked only once the messages are queued, and by the date announced: if it is changed meanwhile it is announced again.
    assets.each { |asset| asset.update_columns(warranty_alerted_on: asset.warranty_expires_on) } # rubocop:disable Rails/SkipsModelValidations -- bookkeeping, not a change to the asset
  end
end
