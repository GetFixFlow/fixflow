require "rails_helper"

RSpec.describe Vendor, type: :model do
  let(:org) { create(:organization) }

  it "needs a name, unique within the company whatever the case, but free to repeat in another company" do
    create(:vendor, organization: org, name: "Acme")

    expect(build(:vendor, organization: org, name: "")).not_to be_valid
    expect(build(:vendor, organization: org, name: "ACME")).not_to be_valid
    expect(build(:vendor, name: "Acme")).to be_valid
  end

  it "keeps an empty phone, email or category as nothing, and refuses an email that is not one" do
    vendor = create(:vendor, organization: org, phone: "  ", email: "", category: " ")

    expect(vendor).to have_attributes(phone: nil, email: nil, category: nil)
    expect(build(:vendor, organization: org, email: "no at sign")).not_to be_valid
  end

  it "is not deleted once it has work orders, but is when it has none, with its contacts" do
    used = create(:vendor, organization: org)
    create(:work_order, organization: org, vendor: used)
    unused = create(:vendor, organization: org)
    create(:vendor_contact, vendor: unused)

    expect(used.destroy).to be(false)
    expect(unused.destroy).to be_truthy
    expect(VendorContact.count).to eq(0)
  end

  it "goes with its company, after the company's work orders" do
    create(:work_order, organization: org, vendor: create(:vendor, organization: org))

    expect { org.destroy! }.to change(described_class, :count).by(-1)
  end
end
