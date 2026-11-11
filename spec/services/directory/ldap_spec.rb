require "rails_helper"

# Uses FakeLdap (spec/support/fake_ldap.rb), a directory in memory. The real thing, OpenLDAP, is tried by script/directory_live.
RSpec.describe Directory::Ldap do
  let(:jo) do
    FakeLdap::Entry.new("uid=jo,ou=people,dc=acme,dc=test",
                        { "uid" => ["jo"], "mail" => ["Jo@Acme.test"], "givenName" => ["Jo"], "sn" => ["Reyes"],
                          "entryUUID" => ["uuid-jo"], "memberOf" => ["cn=fixflow-admins,ou=groups,dc=acme,dc=test"] })
  end
  let(:twin) { FakeLdap::Entry.new("uid=jo2,ou=people,dc=acme,dc=test", { "uid" => ["jo"], "mail" => ["jo@acme.test"] }) }
  let(:server) do
    FakeLdap::Server.new(people: [jo], passwords: { "cn=svc,dc=acme,dc=test" => "svc-pass", jo.dn => "jo-pass" })
  end
  let(:settings) do
    DirectorySettings.new(ldap_enabled: true, ldap_host: "ldap.acme.test", ldap_port: 389, ldap_encryption: "none",
                          ldap_bind_dn: "cn=svc,dc=acme,dc=test", ldap_bind_password: "svc-pass",
                          ldap_user_base: "ou=people,dc=acme,dc=test",
                          default_role: "requester")
  end
  let(:ldap) { described_class.new(settings) }

  before { allow(Net::LDAP).to receive(:new) { |args| server.build(args) } }

  describe "#authenticate" do
    it "returns the person when the password is right, with the groups, a stable id, and a lower-cased email" do
      identity = ldap.authenticate("jo", "jo-pass")

      expect(identity).to have_attributes(provider: "ldap", subject: "uuid-jo", email: "jo@acme.test", first_name: "Jo",
                                          last_name: "Reyes", email_verified: true,
                                          groups: ["cn=fixflow-admins,ou=groups,dc=acme,dc=test"])
    end

    it "finds the person by their email as well as their username" do
      expect(ldap.authenticate("Jo@Acme.test", "jo-pass")).to be_present
    end

    it "checks the password by signing in as the person, not by reading it" do
      ldap.authenticate("jo", "jo-pass")

      expect(server.binds.last).to include(method: :simple, username: jo.dn, password: "jo-pass")
    end

    it "returns nothing for a wrong password" do
      expect(ldap.authenticate("jo", "wrong")).to be_nil
    end

    it "returns nothing for a blank password, which many servers would take as an anonymous sign-in that works" do
      expect(ldap.authenticate("jo", "")).to be_nil
      expect(ldap.authenticate("jo", nil)).to be_nil
      expect(server.binds.none? { |b| b[:username] == jo.dn }).to be(true)
    end

    it "returns nothing for a blank login, or for someone who is not there" do
      expect(ldap.authenticate("", "jo-pass")).to be_nil
      expect(ldap.authenticate("nobody", "jo-pass")).to be_nil
    end

    it "returns nothing when two people have the same login: neither is the one meant" do
      server.people << twin

      expect(ldap.authenticate("jo", "jo-pass")).to be_nil
    end

    it "keeps what was typed out of the filter's own syntax, so a login cannot widen the search" do
      ldap.authenticate("*)(uid=*", "x")

      filter = server.searches.last[:filter]
      expect(filter).not_to include("(uid=*)")
      expect(filter.downcase).to include("\\2a", "\\28", "\\29")
    end

    it "only looks for people the company's filter allows, under the base it named" do
      ldap.authenticate("jo", "jo-pass")

      expect(server.searches.first).to include(base: "ou=people,dc=acme,dc=test")
      expect(server.searches.first[:filter]).to include("objectClass=person")
    end

    it "searches with the service account, and with none when no account is set (a directory that allows it)" do
      settings.ldap_bind_dn = nil
      ldap.authenticate("jo", "jo-pass")

      expect(server.binds.first).to eq(method: :anonymous)
    end

    it "says so, and does not guess, when the service account cannot sign in" do
      settings.ldap_bind_password = "nope"

      expect { ldap.authenticate("jo", "jo-pass") }.to raise_error(Directory::Error, /service account could not sign in/)
    end

    it "says so when the directory cannot be reached" do
      allow(Net::LDAP).to receive(:new).and_raise(Errno::ECONNREFUSED)
      expect { ldap.authenticate("jo", "jo-pass") }.to raise_error(Directory::Error, /Could not use the directory at ldap.acme.test/)
    end

    it "has no email to give when the directory has none for the person, and refuses rather than guess" do
      jo.attrs.delete("mail")

      expect { ldap.authenticate("jo", "jo-pass") }.to raise_error(Directory::Refused, /no email/)
    end

    it "uses the entry's name as the stable id when no id attribute is named" do
      settings.ldap_id_attribute = ""

      expect(ldap.authenticate("jo", "jo-pass").subject).to eq(jo.dn.downcase)
    end

    it "writes a binary id (Active Directory's objectGUID) as hex" do
      settings.ldap_id_attribute = "objectGUID"
      jo.attrs["objectGUID"] = ["\x01\x02\xFF\xAB".b]

      expect(ldap.authenticate("jo", "jo-pass").subject).to eq("0102ffab")
    end

    it "adds the groups that list the person as a member, for a directory with no memberOf" do
      settings.ldap_group_base = "ou=groups,dc=acme,dc=test"
      server.groups_for("")
      allow(server).to receive(:groups_for).and_return([FakeLdap::Entry.new("cn=techs,ou=groups,dc=acme,dc=test", {})])

      expect(ldap.authenticate("jo", "jo-pass").groups).to include("cn=techs,ou=groups,dc=acme,dc=test",
                                                                    "cn=fixflow-admins,ou=groups,dc=acme,dc=test")
    end
  end

  describe "#check" do
    it "reports how many people the search finds" do
      expect(ldap.check).to include(host: "ldap.acme.test", people_found: 1)
    end

    it "says why when the service account is wrong" do
      settings.ldap_bind_password = "nope"

      expect { ldap.check }.to raise_error(Directory::Error, /Invalid Credentials/)
    end
  end

  describe "connection" do
    it "asks for STARTTLS or LDAPS, checking the server's certificate, when told to" do
      settings.ldap_encryption = "starttls"
      ldap.authenticate("jo", "jo-pass")
      expect(server.built.first[:encryption]).to include(method: :start_tls)
      expect(server.built.first[:encryption][:tls_options][:verify_mode]).to eq(OpenSSL::SSL::VERIFY_PEER)

      settings.ldap_encryption = "ssl"
      described_class.new(settings).authenticate("jo", "jo-pass")
      expect(server.built.last[:encryption]).to include(method: :simple_tls)
    end

    it "only skips the certificate check when the company says to" do
      settings.ldap_encryption = "ssl"
      settings.ldap_verify_certificate = false
      ldap.authenticate("jo", "jo-pass")

      expect(server.built.first[:encryption][:tls_options][:verify_mode]).to eq(OpenSSL::SSL::VERIFY_NONE)
    end

    it "sends no encryption setting for a plain connection" do
      ldap.authenticate("jo", "jo-pass")

      expect(server.built.first[:encryption]).to be_nil
    end
  end
end
