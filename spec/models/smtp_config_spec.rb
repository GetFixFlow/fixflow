require "rails_helper"

RSpec.describe SmtpConfig do
  let(:org) { create(:organization) }
  let(:valid) {
    { host: "smtp.office365.com", port: 587, username: "mail@acme.com", password: "s3cret", encryption: "tls",
   from_name: "Acme Maintenance", from_address: "mail@acme.com" }
  }

  def saved(attrs = valid)
    described_class.new.assign(attrs).tap { |c| c.save_to(org) }
    org.reload.smtp_config
  end

  it "keeps the password encrypted in the database, and gives it back when loaded" do
    config = saved

    expect(config.password).to eq("s3cret")
    expect(org.reload.email_settings.to_json).not_to include("s3cret")
    expect(org.email_settings["password_ciphertext"]).to be_present
  end

  it "keeps the saved password when the form leaves it blank" do
    saved
    config = org.reload.smtp_config.assign(host: "smtp.example.com", password: "")
    config.save_to(org)

    expect(org.reload.smtp_config).to have_attributes(host: "smtp.example.com", password: "s3cret")
  end

  it "needs a host and a sender, a sensible port and a known encryption" do
    config = described_class.new.assign(host: "", port: 70_000, encryption: "magic", from_address: "not-an-email")

    expect(config).not_to be_valid
    expect(config.errors.attribute_names).to include(:host, :port, :encryption, :from_address)
  end

  it "needs a sender, not just a host" do
    config = described_class.new.assign(host: "smtp.example.com", from_address: "")

    expect(config).not_to be_valid
    expect(config.errors[:from_address]).to include("can't be blank")
  end

  it "is not complete until it has a host and a sender" do
    expect(described_class.new).not_to be_configured
    expect(described_class.new.assign(host: "smtp.example.com")).not_to be_configured
    expect(described_class.new.assign(host: "smtp.example.com", from_address: "a@b.co")).to be_configured
  end

  it "shows the sender as 'Name <address>'" do
    expect(described_class.new.assign(valid).from).to eq("Acme Maintenance <mail@acme.com>")
    expect(described_class.new.assign(valid.merge(from_name: "")).from).to eq("mail@acme.com")
  end

  describe "#to_mail_settings" do
    it "uses STARTTLS for 'tls'" do
      settings = described_class.new.assign(valid).to_mail_settings
      expect(settings).to include(address: "smtp.office365.com", port: 587, user_name: "mail@acme.com", password: "s3cret",
enable_starttls: :always, tls: false)
    end

    it "uses a secure connection from the start for 'ssl'" do
      settings = described_class.new.assign(valid.merge(encryption: "ssl", port: 465)).to_mail_settings
      expect(settings).to include(tls: true, enable_starttls: false)
    end

    it "uses no encryption for 'none', and no login when there is no username" do
      settings = described_class.new.assign(host: "mail.local", port: 25, encryption: "none", from_address: "a@b.co").to_mail_settings
      expect(settings).to include(tls: false, enable_starttls: false)
      expect(settings).not_to include(:user_name, :password, :authentication)
    end

    it "gives up on a silent server instead of waiting forever" do
      expect(described_class.new.assign(valid).to_mail_settings).to include(open_timeout: 8, read_timeout: 15)
    end
  end
end
