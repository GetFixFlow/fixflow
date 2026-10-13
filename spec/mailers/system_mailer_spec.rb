require "rails_helper"

RSpec.describe SystemMailer, type: :mailer do
  let(:admin) { create(:user, :admin, first_name: "Ada", last_name: "Admin") }

  it "is addressed to the person testing, from the sender being tested, and says what it is for" do
    mail = described_class.test_email(admin, from: "Acme <mail@acme.com>")

    expect(mail.to).to eq([admin.email])
    expect(mail.from).to eq(["mail@acme.com"])
    expect(mail.subject).to eq("[FixFlow] Test email")
    expect(mail.body.encoded).to include("Ada Admin", "mail server settings work")
  end
end
