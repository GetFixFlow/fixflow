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
