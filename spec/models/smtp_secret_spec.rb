require "rails_helper"

RSpec.describe SmtpSecret do
  it "does not give a password back for tampered or foreign data" do
    expect(described_class.decrypt("garbage")).to be_nil
    expect(described_class.decrypt(nil)).to be_nil
  end
end
