module Directory
  # What a successful sign-in at the directory becomes here: the person's account, found or made, its role set from the
  # groups, its name kept up to date. Refuses (Directory::Refused) the person who may not sign in: no account and none
  # to be made, deactivated, or in none of the groups that give a role.
  module Accounts
    module_function

    def sign_in!(identity, settings, organization: Organization.the_company)
      raise Refused.new(:failed, "There is no company set up yet") unless organization

      role = Roles.resolve(identity.groups, settings)
      user = find(identity, settings, organization)
      raise Refused.new(:no_account, "No account for #{identity.email}") if user.nil? && !settings.create_people
      if role.nil? && (user.nil? || settings.sync_roles)
        raise Refused.new(:not_allowed, "#{identity.email} is in none of the groups that may use FixFlow")
      end

      user ||= create!(identity, role, organization)
      raise Refused.new(:deactivated, "#{identity.email} is deactivated") unless user.active?

      update!(user, identity, role, settings)
      user
    end

    # By the directory's own id first (so a changed email still finds the person), then by email: an account that was
    # made here before the directory was set up joins it, when the directory vouches for the address.
    def find(identity, settings, organization)
      user = User.find_by(identity_provider: identity.provider, external_id: identity.subject)
      return user if user

      local = organization.users.find_by(email: identity.email)
      return unless local
      if local.identity_provider.nil?
        return local if trusted_email?(identity, settings)

        raise Refused.new(:email_not_verified,
"#{identity.email} has an account here, and the directory did not say the address is verified")
      end
      raise Refused.new(:account_conflict, "#{identity.email} already signs in through #{local.identity_provider}")
    end

    # A sign-in turned away: in the log for the company's administrators, with the reason and who it was.
    def log_refused(error, identity, request)
      Rails.logger.info "[Directory] sign-in refused (#{error.code}): #{error.message}"
      company = Organization.the_company
      return unless company

      ActivityLogService.log(action: "directory.sign_in_refused", resource: company, user: nil, request: request,
                             metadata: { reason: error.code.to_s, email: identity&.email })
    end

    def trusted_email?(identity, settings) = identity.email_verified == true || settings.oidc_trust_email

    def create!(identity, role, organization)
      first, last = names_for(identity)
      password = SecureRandom.base64(48)
      user = organization.users.create!(email: identity.email, first_name: first, last_name: last, role: role,
                                        password: password, password_confirmation: password, skip_password_policy: true,
                                        identity_provider: identity.provider, external_id: identity.subject)
      ActivityLogService.log(action: "directory.person_created", resource: user, user: user,
metadata: { provider: identity.provider, role: role })
      user
    rescue ActiveRecord::RecordInvalid => e # an address already used elsewhere on this install, or one that is not an address
      raise Refused.new(:account_conflict, "Could not make an account for #{identity.email}: #{e.message}")
    end

    def update!(user, identity, role, settings)
      first, last = names_for(identity, user)
      changes = { identity_provider: identity.provider, external_id: identity.subject, directory_synced_at: Time.current }
      changes[:first_name] = first
      changes[:last_name] = last
      changes[:email] = identity.email if identity.email != user.email && !User.where.not(id: user.id).exists?(email: identity.email)
      # Joining the directory: the old password stops working, so the directory is the only way in.
      changes.merge!(unusable_password) if user.identity_provider.nil?
      # An invitation that was waiting is answered by signing in: it is not left showing as "invited".
      changes.merge!(invitation_token_digest: nil, invitation_accepted_at: Time.current) if user.invitation_pending?
      user.assign_attributes(changes)
      apply_role(user, role) if settings.sync_roles && role
      user.save!
    end

    # The role follows the groups, except that the last active administrator is never taken from the company.
    def unusable_password
      password = SecureRandom.base64(48)
      { password: password, password_confirmation: password, skip_password_policy: true }
    end

    def apply_role(user, role)
      return if user.role == role

      if user.role == "admin" && user.organization.users.active.where(role: "admin").where.not(id: user.id).none?
        ActivityLogService.log(action: "directory.role_kept", resource: user, user: user, metadata: { wanted: role, kept: "admin" })
        return
      end

      ActivityLogService.log(action: "directory.role_changed", resource: user, user: user, metadata: { from: user.role, to: role })
      user.role = role
    end

    def names_for(identity, user = nil)
      first = identity.first_name.presence || user&.first_name.presence
      last = identity.last_name.presence || user&.last_name.presence
      local = identity.email.split("@").first.to_s.tr("._-", " ").split.map(&:capitalize)
      [first || local.first || "Directory", last || local.drop(1).join(" ").presence || "User"]
    end
  end
end
