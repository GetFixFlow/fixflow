require "rails_helper"

RSpec.describe EmailSetup do
  let!(:org) { create(:organization) }
  let(:smtp) { { host: "smtp.example.com", from_address: "noreply@acme.com" } }

  def in_production(smtp_env: {})
    allow(Rails.env).to receive(:production?).and_return(true)
    stub_const("ENV", ENV.to_hash.merge({ "SMTP_HOST" => nil, "SMTP_PASSWORD" => nil }.merge(smtp_env)))
  end

  describe ".source and .configured?" do
    it "is not configured in production when nothing is set up" do
      in_production
      expect(described_class.source).to be_nil
      expect(described_class).not_to be_configured
    end

    it "is configured by the environment's SMTP settings" do
      in_production(smtp_env: { "SMTP_HOST" => "smtp.env.com", "SMTP_PASSWORD" => "pw" })
      expect(described_class.source).to eq(:environment)
      expect(described_class).to be_configured
    end

    it "is configured by what the administrator saved in the app, which wins over the environment" do
      SmtpConfig.new.assign(smtp).save_to(org)
      in_production(smtp_env: { "SMTP_HOST" => "smtp.env.com", "SMTP_PASSWORD" => "pw" })

      expect(described_class.source).to eq(:settings)
      expect(described_class).to be_configured
    end

    it "does not count half-filled settings" do
      SmtpConfig.new.assign(host: "smtp.example.com").save_to(org)
      in_production

      expect(described_class.source).to be_nil
    end

    it "outside production always counts as configured, as mail is captured or logged" do
      expect(described_class).to be_configured
    end
  end
end
