require "rails_helper"

# A saved secret is never sent to a server it was not given for (the "try it" button would otherwise carry it to any host typed in).
RSpec.describe DirectorySettings, "#assign" do
  let(:org) { create(:organization) }
  let(:saved) { described_class.load(org.reload) }

  before do
    described_class.new(
      ldap_enabled: true, ldap_host: "ldap.acme.test", ldap_user_base: "ou=people", ldap_bind_password: "bind-secret",
      oidc_issuer: "https://idp.acme.test", oidc_client_id: "fixflow", oidc_client_secret: "client-secret"
    ).save_to(org)
  end

  it "keeps the secrets when the form leaves them blank and the server is the same" do
    saved.assign(ldap_host: " LDAP.acme.test ", ldap_bind_password: "", oidc_issuer: "https://idp.acme.test", oidc_client_secret: "")

    expect(saved).to have_attributes(ldap_bind_password: "bind-secret", oidc_client_secret: "client-secret")
  end

  it "keeps them when the form does not mention the server" do
    saved.assign(ldap_user_base: "ou=staff", ldap_bind_password: "")

    expect(saved).to have_attributes(ldap_bind_password: "bind-secret", ldap_user_base: "ou=staff")
  end

  it "forgets the LDAP bind password for another directory server, and the client secret for another issuer" do
    saved.assign(ldap_host: "ldap.elsewhere.test", ldap_bind_password: "",
                 oidc_issuer: "https://idp.elsewhere.test", oidc_client_secret: "")

    expect(saved).to have_attributes(ldap_bind_password: nil, oidc_client_secret: nil)
  end

  it "takes a secret typed for the new server" do
    saved.assign(ldap_host: "ldap.elsewhere.test", ldap_bind_password: "new-secret")

    expect(saved.ldap_bind_password).to eq("new-secret")
  end
end
