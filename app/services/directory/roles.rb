module Directory
  # Which role a person's groups in the directory give them here. The groups named in Settings may be written as the
  # group's name ("fixflow-admins") or its full distinguished name ("CN=fixflow-admins,OU=Groups,DC=acme,DC=com"), and
  # the groups the directory reports are matched either way, ignoring case. The highest role of any group matched wins.
  module Roles
    module_function

    # The role, or nil when none of the person's groups is named and no role is given to everyone.
    def resolve(groups, settings)
      wanted = settings.role_groups.to_h.transform_keys(&:to_s)
      held = Array(groups).flat_map { |g| names_for(g) }.uniq
      matched = DirectorySettings::ROLE_ORDER.select do |role|
        Array(wanted[role]).any? { |group| names_for(group).intersect?(held) }
      end
      matched.last || settings.default_role.presence
    end

    # "CN=Fix Flow,OU=x,DC=y" is known as the whole string and as its first name part ("fix flow").
    def names_for(group)
      full = group.to_s.strip.downcase
      return [] if full.empty?

      first = full[/\A\s*(?:cn|uid)\s*=\s*((?:\\.|[^,\\])+)/, 1]
      [full, first&.strip].compact.uniq
    end
  end
end
