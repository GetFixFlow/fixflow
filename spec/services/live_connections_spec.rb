require "rails_helper"

# A live-update connection is checked when it is made, so one stays open after the sign-in behind it ended unless it is closed.
RSpec.describe LiveConnections do
  let(:user)   { create(:user) }
  let(:remote) { instance_double(ActionCable::RemoteConnections::RemoteConnection, disconnect: nil) }

  before { allow(ActionCable.server.remote_connections).to receive(:where).and_return(remote) }

  it "closes the connections open for the person" do
    allow(ActionCable.server.remote_connections).to receive(:where).with(current_user: user).and_return(remote)
    expect(remote).to receive(:disconnect)

    described_class.close_for(user)
  end

  it "does not stop a sign-out because Redis could not be reached" do
    allow(remote).to receive(:disconnect).and_raise(Redis::CannotConnectError)

    expect { described_class.close_for(user) }.not_to raise_error
  end

  describe "when a sign-in ends" do
    it "closes them when the person signs out, changes their password or is deactivated (a new jti, or a deactivation)" do
      expect(remote).to receive(:disconnect).twice

      user.update!(jti: SecureRandom.uuid)
      user.update!(deactivated_at: Time.current)
    end

    it "does not close them for an ordinary change of details" do
      expect(remote).not_to receive(:disconnect)

      user.update!(first_name: "Changed")
    end

    it "closes them when a session is ended in 'Where you are signed in'" do
      session = UserSession.create!(user: user, sid: SecureRandom.uuid, jti: user.jti, expires_at: 1.day.from_now,
                                    last_active_at: Time.current)
      expect(remote).to receive(:disconnect).once

      session.revoke!
    end
  end
end
