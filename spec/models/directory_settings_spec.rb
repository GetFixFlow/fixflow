require "rails_helper"

RSpec.describe DirectorySettings do
  let(:org) { create(:organization) }

  def valid_oidc(**overrides)
    described_class.new({ oidc_enabled: true, oidc_issuer: "https://idp.example.test/realms/acme", oidc_client_id: "fixflow",
                          default_role: "requester" }.merge(overrides))
  end

  it "starts with everything off, so a company that never opens the screen signs in as before" do
    settings = described_class.load(org)

    expect(settings.oidc?).to be(false)
    expect(settings.ldap?).to be(false)
    expect(settings.any?).to be(false)
    expect(settings.public_view).to eq(oidc: { enabled: false, label: "Company account" }, ldap: { enabled: false })
  end

  it "keeps the secrets encrypted in the database and gives them back when loaded" do
    valid_oidc(oidc_client_secret: "top-secret", ldap_bind_password: "bind-pass").save_to(org)

    stored = org.reload.directory_settings
    expect(stored.to_json).not_to include("top-secret")
    expect(stored.to_json).not_to include("bind-pass")
    expect(stored["oidc_client_secret_ciphertext"]).to be_present

    loaded = described_class.load(org)
    expect(loaded.oidc_client_secret).to eq("top-secret")
    expect(loaded.ldap_bind_password).to eq("bind-pass")
  end

  it "never sends a secret to the settings screen, only whether it is set" do
    form = valid_oidc(oidc_client_secret: "top-secret").as_form

    expect(form.keys).not_to include("oidc_client_secret", "ldap_bind_password")
    expect(form).to include("oidc_secret_set" => true, "ldap_password_set" => false)
    expect(form.to_json).not_to include("top-secret")
  end

  it "keeps the saved secret when the form leaves it blank, and replaces it when one is typed" do
    valid_oidc(oidc_client_secret: "first").save_to(org)

    settings = described_class.load(org).assign(oidc_client_secret: "", oidc_label: "Acme")
    expect(settings.oidc_client_secret).to eq("first")

    settings.assign(oidc_client_secret: "second")
    expect(settings.oidc_client_secret).to eq("second")
  end

  describe "validation" do
    it "needs the issuer and the client id once OpenID Connect is on" do
      settings = described_class.new(oidc_enabled: true, default_role: "requester")

      expect(settings).not_to be_valid
      expect(settings.errors[:oidc_issuer]).to be_present
      expect(settings.errors[:oidc_client_id]).to be_present
    end

    it "needs the server and the base once LDAP is on" do
      settings = described_class.new(ldap_enabled: true, default_role: "requester")

      expect(settings).not_to be_valid
      expect(settings.errors[:ldap_host]).to be_present
      expect(settings.errors[:ldap_user_base]).to be_present
    end

    it "refuses an issuer that is not https, so a client secret never crosses the open internet" do
      expect(valid_oidc(oidc_issuer: "http://idp.example.test/realms/acme")).not_to be_valid
      expect(valid_oidc(oidc_issuer: "not a url")).not_to be_valid
      expect(valid_oidc(oidc_issuer: "https://idp.example.test/realms/acme")).to be_valid
    end

    it "accepts plain http for a provider on this computer, for trying it out" do
      expect(valid_oidc(oidc_issuer: "http://localhost:8080/realms/acme")).to be_valid
      expect(valid_oidc(oidc_issuer: "http://127.0.0.1:8080/realms/acme")).to be_valid
    end

    it "refuses to be switched on with no way for anyone to get a role, so people are not signed in only to be turned away" do
      settings = valid_oidc(default_role: nil, role_groups: {})

      expect(settings).not_to be_valid
      expect(settings.errors[:base].first).to match(/groups for at least one role/)
    end

    it "is satisfied by a group for a role, or by a role for everyone" do
      expect(valid_oidc(default_role: nil, role_groups: { "admin" => ["fixflow-admins"] })).to be_valid
      expect(valid_oidc(default_role: "requester", role_groups: {})).to be_valid
    end

    it "only knows the four roles" do
      expect(valid_oidc(role_groups: { "owner" => ["x"] })).not_to be_valid
      expect(valid_oidc(default_role: "owner")).not_to be_valid
    end

    it "does not ask for anything while everything is off" do
      expect(described_class.new).to be_valid
    end
  end

  describe "#assign" do
    it "takes a group on each line, or a list, and drops blanks and unknown roles" do
      settings = described_class.new.assign(role_groups: { "admin" => "fixflow-admins\n\n  ops  \r\nfixflow-admins",
"manager" => ["", "leads"], "owner" => "x" })

      expect(settings.role_groups).to eq("admin" => %w[fixflow-admins ops], "manager" => %w[leads])
    end

    it "ignores fields it does not know" do
      expect { described_class.new.assign(bogus: "x", oidc_label: "Acme") }.not_to raise_error
    end
  end
end
