class IotChannel < ApplicationCable::Channel
  def subscribed
    asset_id = params[:asset_id]
    reject unless asset_id.present? && authorized_for_asset?(asset_id.to_i)
    stream_from "iot_channel_asset_#{asset_id}"
  end

  def unsubscribed
    stop_all_streams
  end

  private

  def authorized_for_asset?(asset_id)
    current_user.organization.assets.exists?(id: asset_id)
  end
end
