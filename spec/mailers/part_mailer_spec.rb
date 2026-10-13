require "rails_helper"

RSpec.describe PartMailer, type: :mailer do
  let(:org)     { create(:organization) }
  let(:manager) { create(:user, :manager, organization: org, first_name: "Mia") }
  let(:part)    {
    create(:part, organization: org, name: "Hydraulic seal", sku: "HS-9", quantity_on_hand: 2, reorder_point: 3, unit: "each")
  }

  it "says what is low, how much is left, and links to the parts page" do
    mail = described_class.low_stock(manager, part, "low")

    expect(mail.to).to eq([manager.email])
    expect(mail.subject).to eq("[FixFlow] Running low: Hydraulic seal")
    body = mail.body.encoded
    expect(body).to include("Mia", "Hydraulic seal (HS-9)", "fallen to its reorder point", "2.0 each", "3.0 each",
"#{EmailSetup.base_url}/parts")
  end

  it "says so plainly when it has run out" do
    mail = described_class.low_stock(manager, create(:part, organization: org, name: "Hydraulic seal", quantity_on_hand: 0), "out")

    expect(mail.subject).to eq("[FixFlow] Out of stock: Hydraulic seal")
    expect(mail.body.encoded).to include("has run out of stock")
  end
end
