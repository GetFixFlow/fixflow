require "rails_helper"

RSpec.describe VendorContact, type: :model do
  it "needs a name and, when it has an email, a real one" do
    expect(build(:vendor_contact, name: "")).not_to be_valid
    expect(build(:vendor_contact, email: "nope")).not_to be_valid
    expect(build(:vendor_contact, email: "a@b.example")).to be_valid
  end
end
