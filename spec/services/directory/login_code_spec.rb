require "rails_helper"

RSpec.describe Directory::LoginCode do
  let(:user) { create(:user) }
  let(:cache) { ActiveSupport::Cache::MemoryStore.new }

  before { allow(Rails).to receive(:cache).and_return(cache) }

  it "gives back the person it was made for" do
    expect(described_class.redeem(described_class.issue(user))).to eq(user)
  end

  it "works once" do
    code = described_class.issue(user)

    expect(described_class.redeem(code)).to eq(user)
    expect(described_class.redeem(code)).to be_nil
  end

  it "expires after a minute" do
    code = described_class.issue(user)

    travel 61.seconds do
      expect(described_class.redeem(code)).to be_nil
    end
  end

  it "stops working when the person's sessions were ended (a new jti)" do
    code = described_class.issue(user)
    user.update!(jti: SecureRandom.uuid)

    expect(described_class.redeem(code)).to be_nil
  end

  it "refuses anything that is not one of its own notes" do
    expect(described_class.redeem("nonsense")).to be_nil
    expect(described_class.redeem(nil)).to be_nil
    expect(described_class.redeem(TwoFactorChallenge.issue(user))).to be_nil
  end
end
