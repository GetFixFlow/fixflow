# What an admin may do to the people in their company: deactivate, reactivate, change
# role, delete. Refuses anything that could lock the company out of its own system.
class UserAdministration
  class Refused < StandardError; end

  class << self
    def deactivate!(user, by:)
      guard_self!(user, by, "deactivate your own account")
      guarded(user) do
        user.update!(deactivated_at: Time.current, jti: SecureRandom.uuid) # new jti signs them out everywhere
      end
    end

    def reactivate!(user)
      user.update!(deactivated_at: nil)
    end

    def change_role!(user, role, by:)
      raise Refused, "#{role.inspect} is not a role" unless User::ROLES.include?(role.to_s)
      return user if user.role == role.to_s

      guard_self!(user, by, "change your own role")
      guarded(user) { user.update!(role: role.to_s) }
    end

    # For a lost phone: switches the person's two-factor sign-in off and signs them out everywhere (they sign in with
    # their password and, if the company requires it, set it up again).
    def reset_two_factor!(user, by:)
      guard_self!(user, by, "reset your own two-factor sign-in here (use Settings, Security)")
      unless user.two_factor_enabled? || user.two_factor_pending?
        raise Refused, "#{user.full_name} does not have two-factor sign-in on."
      end

      user.disable_two_factor!
      user.update!(jti: SecureRandom.uuid)
      ActivityLogService.log(action: "user.two_factor_reset", resource: user, user: by)
    end

    # Opens an account locked for too many wrong passwords, before its 30 minutes are over.
    def unlock!(user, by:)
      raise Refused, "#{user.full_name} is not locked." unless user.access_locked?

      user.unlock_access!
      ActivityLogService.log(action: "user.unlocked", resource: user, user: by)
    end

    def delete!(user, by:)
      guard_self!(user, by, "delete your own account")
      guarded(user) { user.destroy! }
    end

    private

    def guard_self!(user, by, action)
      raise Refused, "You can't #{action}." if user.id == by.id
    end

    # Serialize on the company row so two admins cannot remove each other at once, and
    # never let the last active admin go.
    def guarded(user)
      user.organization.with_lock do
        yield
        raise Refused, "At least one active admin is required." if user.organization.users.active.where(role: "admin").none?
      end
    end
  end
end
