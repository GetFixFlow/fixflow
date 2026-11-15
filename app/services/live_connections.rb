# Closes the live-update (WebSocket) connections a person has open. A connection is checked when it is made, so without this
# one stays open after the sign-in behind it has ended: signing out, ending a session in "Where you are signed in", changing
# the password, an administrator resetting two-factor or deactivating the person. The pages reconnect by themselves, and
# a connection made with an ended sign-in is refused (see ApplicationCable::Connection).
module LiveConnections
  def self.close_for(user)
    ActionCable.server.remote_connections.where(current_user: user).disconnect
  rescue StandardError => e
    # Never let a problem reaching Redis stop the sign-out that asked for this.
    Rails.logger.warn "[LiveConnections] could not close connections of user #{user.id}: #{e.class}"
  end
end
