# Live alerts for the IoT screens: every alert raised in the signed-in person's own company, as it happens.
# The stream is the person's company, never something they send, so nobody can listen to another company.
class IotAlertChannel < ApplicationCable::Channel
  def subscribed
    stream_from self.class.stream_for_company(current_user.organization_id)
  end

  def unsubscribed
    stop_all_streams
  end

  def self.stream_for_company(organization_id) = "iot_alerts_org_#{organization_id}"
end
