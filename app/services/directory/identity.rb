module Directory
  # Who the directory says a person is, once they have proved it: the same shape from OpenID Connect and from LDAP.
  # `email_verified` is true only when the directory vouches that the person owns the address (LDAP always does: the
  # directory's own record is the address); an OpenID provider that does not say leaves it nil.
  Identity = Data.define(:provider, :subject, :email, :first_name, :last_name, :groups, :email_verified) do
    def initialize(provider:, subject:, email:, first_name: nil, last_name: nil, groups: [], email_verified: nil)
      super(provider: provider.to_s, subject: subject.to_s, email: email.to_s.strip.downcase,
            first_name: first_name.to_s.strip, last_name: last_name.to_s.strip,
            groups: Array(groups).map(&:to_s).compact_blank.uniq, email_verified: email_verified)
    end
  end
end
