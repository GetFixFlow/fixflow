require "rails_helper"

RSpec.describe InvitationMailer, type: :mailer do
  let(:org)     { create(:organization, name: "Acme Corp") }
  let(:admin)   { create(:user, :admin, organization: org, first_name: "Ada", last_name: "Admin") }
  let(:invitee) { create(:user, organization: org, first_name: "Nina", role: "technician", invited_by: admin) }
  let(:url)     { "https://app.example.com/accept-invite?token=abc123" }

  it "addresses the invitee and carries the link, company, inviter and role" do
    mail = described_class.invite(invitee, url, "Welcome aboard")

    expect(mail.to).to eq([invitee.email])
    expect(mail.subject).to include("Acme Corp")
    body = mail.body.encoded
    expect(body).to include("Nina", "Ada Admin", "Acme Corp", "technician", url, "Welcome aboard")
  end

  it "leaves out the personal message when none was given" do
    mail = described_class.invite(invitee, url, "")
    expect(mail.body.encoded).not_to include('""')
  end
end
