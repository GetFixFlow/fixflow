require "rails_helper"

RSpec.describe ApplicationCable::Connection, type: :channel do
  let(:org)  { create(:organization) }
  let(:user) { create(:user, :admin, organization: org) }

  # A token as sign-in makes it: with a session behind it.
  def token_for(record)
    token, payload = Warden::JWTAuth::UserEncoder.new.call(record, :user, nil)
    record.on_jwt_dispatch(token, payload)
    token
  end

  it "connects a user with a current token" do
    connect "/cable?token=#{token_for(user)}"
    expect(connection.current_user).to eq(user)
  end

  it "rejects a token that has since been revoked" do
    token = token_for(user)
    user.update!(jti: SecureRandom.uuid) # what sign-out, a password change or deactivation does

    expect { connect "/cable?token=#{token}" }.to have_rejected_connection
  end

  it "rejects a token whose session was ended, and keeps the user's other sessions connected" do
    ended = token_for(user)
    kept = token_for(user)
    user.user_sessions.find_by!(sid: Warden::JWTAuth::TokenDecoder.new.call(ended)["sid"]).revoke!

    expect { connect "/cable?token=#{ended}" }.to have_rejected_connection
    connect "/cable?token=#{kept}"
    expect(connection.current_user).to eq(user)
  end

  it "rejects a token with no session at all (made without signing in)" do
    token = Warden::JWTAuth::UserEncoder.new.call(user, :user, nil).first

    expect { connect "/cable?token=#{token}" }.to have_rejected_connection
  end

  it "rejects a deactivated user" do
    token = token_for(user)
    create(:user, :admin, organization: org).tap { |other| UserAdministration.deactivate!(user, by: other) }

    expect { connect "/cable?token=#{token}" }.to have_rejected_connection
  end

  it "rejects a missing or malformed token" do
    expect { connect "/cable" }.to have_rejected_connection
    expect { connect "/cable?token=nonsense" }.to have_rejected_connection
  end
end
