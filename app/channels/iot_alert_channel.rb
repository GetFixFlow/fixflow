# Live alerts for the IoT screens: every alert raised in the signed-in person's own company, as it happens.
# The stream is the person's company, never something they send, so nobody can listen to another company. A person who works at
# some sites only (see SiteAccess) hears their sites' alerts and those of assets in no site, not the other sites'.
class IotAlertChannel < ApplicationCable::Channel
  def subscribed
    return reject if current_user.requester? # sensor alerts are for the people who look after the equipment

    organization_id = current_user.organization_id
    return stream_from self.class.stream_for_company(organization_id) if SiteAccess.hidden_location_ids(current_user).nil?

    SiteMembership.where(user_id: current_user.id).pluck(:site_id).push(nil).each do |site_id|
      stream_from self.class.stream_for_site(organization_id, site_id)
    end
  end

  def unsubscribed
    stop_all_streams
  end

  def self.stream_for_company(organization_id) = "iot_alerts_org_#{organization_id}"

  # The alerts of one site, or (nil) of assets that are in no site.
  def self.stream_for_site(organization_id, site_id) = "iot_alerts_org_#{organization_id}_site_#{site_id || 'none'}"
end
