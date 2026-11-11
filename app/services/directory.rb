# Signing in through the company directory: OpenID Connect (Directory::Oidc) and LDAP (Directory::Ldap), the groups
# that give a role (Directory::Roles) and the account a sign-in ends up on (Directory::Accounts).
module Directory
  # Where the API is, as the identity provider and the browser reach it (the redirect address registered with the
  # provider). The same address as the web app unless API_URL says otherwise.
  def self.api_url = (ENV["API_URL"].presence || EmailSetup.base_url).chomp("/")
end
