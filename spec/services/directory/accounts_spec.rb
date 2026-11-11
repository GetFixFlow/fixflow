require "rails_helper"

RSpec.describe Directory::Accounts do
  let!(:org) { create(:organization) }
  let(:settings) { oidc_settings }

  def identity(**overrides)
    Directory::Identity.new(provider: "oidc", subject: "sub-1", email: "sam@example.test", first_name: "Sam", last_name: "Rivera",
                              groups: ["fixflow-technicians"], email_verified: true, **overrides)
  end

  def sign_in(who = identity, with = settings) = described_class.sign_in!(who, with, organization: org)

  context "when a person has no account yet" do
    it "makes one, with the role their group gives, and the directory's name" do
      user = sign_in

      expect(user).to be_persisted
      expect(user).to have_attributes(email: "sam@example.test", first_name: "Sam", last_name: "Rivera", role: "technician",
                                      identity_provider: "oidc", external_id: "sub-1", organization: org)
      expect(user.directory_synced_at).to be_within(5.seconds).of(Time.current)
      expect(user).to be_directory_user
    end

    it "gives a password nobody knows, so the directory is the only way in" do
      oidc_settings.save_to(org)
      user = sign_in

      expect(user.valid_password?("password123")).to be(false)
      expect(user.can_reset_password?).to be(false)
    end

    it "writes it in the audit log" do
      sign_in

      expect(ActivityLog.where(action: "directory.person_created").count).to eq(1)
    end

    it "makes up a name from the email when the directory gave none" do
      user = sign_in(identity(first_name: "", last_name: "", email: "pat.o-neil@example.test", subject: "s2"))

      expect(user).to have_attributes(first_name: "Pat", last_name: "O Neil")
    end

    it "is refused when the company has turned off making accounts" do
      expect { sign_in(identity, oidc_settings(create_people: false)) }.to raise_error(Directory::Refused) { |e| expect(e.code).to eq(:no_account) }
      expect(User.where(email: "sam@example.test")).to be_empty
    end

    it "is refused when the person is in none of the groups and the company gives no role to everyone" do
      expect { sign_in(identity(groups: ["marketing"])) }.to raise_error(Directory::Refused) { |e| expect(e.code).to eq(:not_allowed) }
      expect(User.where(email: "sam@example.test")).to be_empty
    end

    it "gives the default role to a person in none of the groups, when there is one" do
      user = sign_in(identity(groups: ["marketing"]), oidc_settings(default_role: "requester"))

      expect(user.role).to eq("requester")
    end
  end

  context "when a person signed in before" do
    let!(:user) { sign_in }

    it "finds them by the directory's id, even when their email there has changed" do
      again = sign_in(identity(email: "sam.rivera@example.test"))

      expect(again.id).to eq(user.id)
      expect(again.reload.email).to eq("sam.rivera@example.test")
      expect(User.count).to eq(1)
    end

    it "does not take over another account's email when theirs changes to it" do
      other = create(:user, organization: org, email: "taken@example.test")

      again = sign_in(identity(email: "taken@example.test"))

      expect(again.id).to eq(user.id)
      expect(again.reload.email).to eq("sam@example.test")
      expect(other.reload.email).to eq("taken@example.test")
    end

    it "moves the role when the groups change, and says so in the audit log" do
      again = sign_in(identity(groups: ["fixflow-admins"]))

      expect(again.reload.role).to eq("admin")
      log = ActivityLog.where(action: "directory.role_changed").last
      expect(log.metadata).to include("from" => "technician", "to" => "admin")
    end

    it "leaves the role alone when the company turned off following the groups" do
      user.update!(role: "manager")

      sign_in(identity(groups: ["fixflow-admins"]), oidc_settings(sync_roles: false))

      expect(user.reload.role).to eq("manager")
    end

    it "turns away a person removed from every group, instead of leaving them their old role" do
      expect { sign_in(identity(groups: [])) }.to raise_error(Directory::Refused) { |e| expect(e.code).to eq(:not_allowed) }
    end

    it "does not let the directory take the last administrator out of the company" do
      user.update!(role: "admin")

      again = sign_in(identity(groups: ["fixflow-technicians"]))

      expect(again.reload.role).to eq("admin")
      expect(ActivityLog.where(action: "directory.role_kept")).to exist
    end

    it "takes an administrator down when another administrator remains" do
      user.update!(role: "admin")
      create(:user, :admin, organization: org)

      expect(sign_in(identity(groups: ["fixflow-technicians"])).reload.role).to eq("technician")
    end

    it "does not bring back someone an administrator deactivated here" do
      user.update!(deactivated_at: Time.current)

      expect { sign_in }.to raise_error(Directory::Refused) { |e| expect(e.code).to eq(:deactivated) }
      expect(user.reload.deactivated_at).to be_present
    end
  end

  context "when a person already has a FixFlow account with their email" do
    let!(:local) { create(:user, organization: org, email: "sam@example.test", role: "manager") }

    it "joins it when the directory vouches for the address, and the old password stops working" do
      user = sign_in(identity(email_verified: true))

      expect(user.id).to eq(local.id)
      expect(user.reload).to have_attributes(identity_provider: "oidc", external_id: "sub-1", role: "technician")
      expect(user.valid_password?("password123")).to be(false)
    end

    it "counts as accepting an invitation that was waiting for them" do
      local.invite!(invited_by: create(:user, :admin, organization: org))
      expect(local.reload).to be_invitation_pending

      user = sign_in

      expect(user.reload).not_to be_invitation_pending
      expect(user.invitation_accepted_at).to be_present
    end

    it "is refused when the provider did not say the address is verified" do
      expect { sign_in(identity(email_verified: nil)) }.to raise_error(Directory::Refused) { |e| expect(e.code).to eq(:email_not_verified) }
      expect(local.reload.identity_provider).to be_nil
      expect(local.valid_password?("password123")).to be(true)
    end

    it "joins it anyway when the company says to trust the provider's addresses" do
      user = sign_in(identity(email_verified: nil), oidc_settings(oidc_trust_email: true))

      expect(user.id).to eq(local.id)
    end

    it "is refused when the account belongs to another directory" do
      local.update!(identity_provider: "ldap", external_id: "uid-9")

      expect { sign_in }.to raise_error(Directory::Refused) { |e| expect(e.code).to eq(:account_conflict) }
    end

    it "never takes over an account in another company, and cannot make a second one with the same address" do
      other_org = create(:organization)
      other = create(:user, organization: other_org, email: "pat@example.test")

      expect { sign_in(identity(email: "pat@example.test", subject: "s-pat")) }.to raise_error(Directory::Refused) { |e| expect(e.code).to eq(:account_conflict) }
      expect(other.reload.identity_provider).to be_nil
    end
  end
end
