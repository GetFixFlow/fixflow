class IotChannel < ApplicationCable::Channel
  def subscribed
    asset_id = params[:asset_id]
    return reject unless asset_id.present? && !current_user.requester? && authorized_for_asset?(asset_id.to_i)

    stream_from "iot_channel_asset_#{asset_id}"
  end

  def unsubscribed
    stop_all_streams
  end

  private

  def authorized_for_asset?(asset_id)
    Current.hidden_location_ids = SiteAccess.hidden_location_ids(current_user) # a person at some sites only hears those sites' assets
    current_user.organization.assets.exists?(id: asset_id)
  end
end
