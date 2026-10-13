require "rails_helper"

RSpec.describe ApplicationCable::Connection, type: :channel do
  let(:org)  { create(:organization) }
  let(:user) { create(:user, :admin, organization: org) }

  def token_for(record)
    Warden::JWTAuth::UserEncoder.new.call(record, :user, nil).first
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
