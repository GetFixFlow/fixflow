require "rails_helper"

# Spies read better here than expectations set up front: the point is what was sent where.
# rubocop:disable RSpec/MessageSpies

RSpec.describe FixflowMailDelivery do
  let(:org)  { create(:organization) }
  let(:mail) { Mail.new(from: "noreply@fixflow.dev", to: "x@acme.com", subject: "Hi", body: "Hello") }
  let(:smtp) { instance_double(Mail::SMTP, deliver!: true) }

  # Anything other than the mail servers under test (Mail builds its own default one) is left alone.
  before do
    allow(Mail::SMTP).to receive(:new).and_call_original
    allow(Mail::SMTP).to receive(:new).with(hash_including(address: anything)).and_return(smtp)
  end

  it "sends through the mail server saved in the app, as the saved sender" do
    SmtpConfig.new.assign(host: "mail.acme.com", port: 2525, encryption: "none", from_name: "Acme",
from_address: "mail@acme.com").save_to(org)

    described_class.new.deliver!(mail)

    expect(Mail::SMTP).to have_received(:new).with(hash_including(address: "mail.acme.com", port: 2525))
    expect(mail[:from].to_s).to eq("Acme <mail@acme.com>")
    expect(smtp).to have_received(:deliver!).with(mail)
  end

  it "uses the environment's mail server when none is saved, leaving the sender alone" do
    org
    stub_const("ENV",
ENV.to_hash.merge("SMTP_HOST" => "smtp.env.com", "SMTP_PORT" => "2587", "SMTP_USERNAME" => "u", "SMTP_PASSWORD" => "p"))

    described_class.new.deliver!(mail)

    expect(Mail::SMTP).to have_received(:new).with(hash_including(address: "smtp.env.com", port: 2587, user_name: "u", password: "p"))
    expect(mail[:from].to_s).to eq("noreply@fixflow.dev")
  end

  it "picks up a change to the saved settings on the next email, without a restart" do
    config = SmtpConfig.new.assign(host: "old.acme.com", from_address: "a@acme.com")
    config.save_to(org)
    described_class.new.deliver!(mail)

    config.assign(host: "new.acme.com").save_to(org)
    described_class.new.deliver!(Mail.new(from: "x@y.co", to: "x@acme.com", subject: "Again", body: "Hi"))

    expect(Mail::SMTP).to have_received(:new).with(hash_including(address: "old.acme.com")).once
    expect(Mail::SMTP).to have_received(:new).with(hash_including(address: "new.acme.com")).once
  end

  it "is registered as a delivery method, so production can use it" do
    expect(ActionMailer::Base.delivery_methods[:fixflow]).to eq(described_class)
  end
end
# rubocop:enable RSpec/MessageSpies
