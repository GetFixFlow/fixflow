require "rails_helper"

RSpec.describe PushKeys do
  let(:secret) { "a-secret-key-base-for-this-spec-" * 3 }

  it "makes the same pair from the same secret, every time, with nothing stored" do
    expect(described_class.pair(secret)).to eq(described_class.pair(secret.dup))
  end

  it "makes another pair from another secret (so changing SECRET_KEY_BASE changes the keys)" do
    expect(described_class.pair(secret)).not_to eq(described_class.pair("another-secret-key-base-for-this-spec-" * 2))
  end

  it "makes a real P-256 pair: the public key is the private key's point, in the form a browser takes (65 bytes)" do
    pair = described_class.pair(secret)
    private_bytes = Base64.urlsafe_decode64(pair[:private_key])
    public_bytes = Base64.urlsafe_decode64(pair[:public_key])
    group = OpenSSL::PKey::EC::Group.new("prime256v1")

    expect(private_bytes.bytesize).to eq(32)
    expect(public_bytes.bytesize).to eq(65)
    expect(public_bytes.getbyte(0)).to eq(4) # an uncompressed point
    expect(group.generator.mul(OpenSSL::BN.new(private_bytes, 2)).to_octet_string(:uncompressed)).to eq(public_bytes)
    expect(pair[:public_key]).not_to include("=")
  end

  it "is a pair the web-push library accepts and signs with" do
    pair = described_class.pair(secret)
    key = WebPush::VapidKey.from_keys(pair[:public_key], pair[:private_key])

    expect(key.public_key_for_push_header).to eq(pair[:public_key])
    expect(JWT.encode({ aud: "https://push.example.test" }, key.curve, "ES256")).to be_present
  end

  it "uses the app's secret, and never gives away the private half through the public key" do
    expect(described_class.public_key).to eq(described_class.pair(Rails.application.secret_key_base)[:public_key])
    expect(described_class.public_key).not_to include(described_class.pair[:private_key])
  end

  describe ".subject" do
    it "is the address of the install when that is https, else the sender address emails come from" do
      expect(described_class.subject("APP_URL" => "https://fixflow.example.com")).to eq("https://fixflow.example.com")
      expect(described_class.subject("APP_URL" => "http://10.0.0.5",
"MAILER_FROM" => "fixflow@example.com")).to eq("mailto:fixflow@example.com")
      expect(described_class.subject({})).to eq("mailto:noreply@fixflow.dev")
    end
  end
end
