# How the company's people sign in through its directory, kept on the organization: OpenID Connect (Keycloak, Microsoft
# Entra, Okta, Google...) and LDAP (Active Directory, OpenLDAP...), and how groups in the directory become roles here.
# The two secrets (the OpenID client secret and the LDAP service account's password) are encrypted.
class DirectorySettings
  include ActiveModel::Model
  include ActiveModel::Attributes

  ENCRYPTIONS = %w[none starttls ssl].freeze
  # From the least to the most that a role may do: a person in the groups of several roles gets the highest.
  ROLE_ORDER = %w[requester technician manager admin].freeze
  PLAIN_FIELDS = %w[
    oidc_enabled oidc_label oidc_issuer oidc_client_id oidc_scopes oidc_groups_claim oidc_trust_email
    ldap_enabled ldap_host ldap_port ldap_encryption ldap_verify_certificate ldap_ca_certificate ldap_bind_dn
    ldap_user_base ldap_user_filter ldap_login_attributes ldap_email_attribute ldap_first_name_attribute
    ldap_last_name_attribute ldap_id_attribute ldap_groups_attribute ldap_group_base
    create_people sync_roles default_role role_groups
  ].freeze
  SECRET_FIELDS = { "oidc_client_secret" => "oidc_client_secret_ciphertext",
                    "ldap_bind_password" => "ldap_bind_password_ciphertext" }.freeze

  # ── OpenID Connect ──
  attribute :oidc_enabled, :boolean, default: false
  attribute :oidc_label, :string, default: "Company account"   # the button reads "Sign in with <label>"
  attribute :oidc_issuer, :string                              # https://keycloak.example.com/realms/acme
  attribute :oidc_client_id, :string
  attribute :oidc_client_secret, :string
  attribute :oidc_scopes, :string, default: "openid email profile"
  attribute :oidc_groups_claim, :string, default: "groups"     # "roles" for Entra app roles
  attribute :oidc_trust_email, :boolean, default: false        # join an existing account by an email the provider never verified

  # ── LDAP / Active Directory ──
  attribute :ldap_enabled, :boolean, default: false
  attribute :ldap_host, :string
  attribute :ldap_port, :integer, default: 389
  attribute :ldap_encryption, :string, default: "starttls"
  attribute :ldap_verify_certificate, :boolean, default: true
  attribute :ldap_ca_certificate, :string
  attribute :ldap_bind_dn, :string
  attribute :ldap_bind_password, :string
  attribute :ldap_user_base, :string
  attribute :ldap_user_filter, :string, default: "(objectClass=person)"
  attribute :ldap_login_attributes, :string, default: "mail,uid,sAMAccountName,userPrincipalName"
  attribute :ldap_email_attribute, :string, default: "mail"
  attribute :ldap_first_name_attribute, :string, default: "givenName"
  attribute :ldap_last_name_attribute, :string, default: "sn"
  attribute :ldap_id_attribute, :string, default: "entryUUID"  # "objectGUID" for Active Directory; blank uses the DN
  attribute :ldap_groups_attribute, :string, default: "memberOf"
  attribute :ldap_group_base, :string                          # for directories with no memberOf: groups are searched here

  # ── Both ──
  attribute :create_people, :boolean, default: true            # a person signing in for the first time gets an account
  attribute :sync_roles, :boolean, default: true               # the role follows the groups at every sign-in
  attribute :default_role, :string                             # for people in none of the groups below; blank refuses them
  attribute :role_groups, default: -> { {} }                   # { "admin" => ["fixflow-admins"], ... }

  validates :oidc_issuer, :oidc_client_id, presence: true, if: :oidc_enabled
  validates :ldap_host, :ldap_user_base, presence: true, if: :ldap_enabled
  validates :ldap_port, numericality: { only_integer: true, greater_than: 0, less_than: 65_536 }
  validates :ldap_encryption, inclusion: { in: ENCRYPTIONS }
  validates :default_role, inclusion: { in: User::ROLES }, allow_blank: true
  validate :issuer_is_a_safe_address, if: -> { oidc_issuer.present? }
  validate :role_groups_are_known
  validate :a_way_to_give_roles, if: -> { oidc_enabled || ldap_enabled }

  def self.load(organization)
    saved = (organization&.directory_settings || {}).with_indifferent_access
    secrets = SECRET_FIELDS.to_h { |name, column| [name, DirectorySecret.decrypt(saved[column])] }
    new(saved.slice(*PLAIN_FIELDS).merge(secrets))
  end

  # The company's own settings: the one company of this install.
  def self.current = self.load(Organization.the_company)

  # Change from form input. A blank secret means "keep the one already saved".
  def assign(changes)
    changes = changes.to_h.with_indifferent_access
    SECRET_FIELDS.each_key { |name| changes.delete(name) if changes[name].blank? }
    changes[:role_groups] = clean_role_groups(changes[:role_groups]) if changes.key?(:role_groups)
    self.attributes = changes.slice(*PLAIN_FIELDS, *SECRET_FIELDS.keys).transform_values { |v| v.is_a?(String) ? v.strip : v }
    self
  end

  def save_to(organization)
    organization.update!(directory_settings: stored_form)
  end

  def oidc? = oidc_enabled && oidc_issuer.present? && oidc_client_id.present?
  def ldap? = ldap_enabled && ldap_host.present? && ldap_user_base.present?
  def any? = oidc? || ldap?
  def oidc_secret_set? = oidc_client_secret.present?
  def ldap_password_set? = ldap_bind_password.present?
  def ldap_login_attribute_list = ldap_login_attributes.to_s.split(/[\s,]+/).compact_blank.uniq

  # What the login page needs to know: whether to show the company button and the username field.
  def public_view
    { oidc: { enabled: oidc?, label: oidc_label.presence || "Company account" }, ldap: { enabled: ldap? } }
  end

  # What the settings screen shows. The secrets are never sent back, only whether they are set.
  def as_form
    attributes.except(*SECRET_FIELDS.keys).merge("oidc_secret_set" => oidc_secret_set?, "ldap_password_set" => ldap_password_set?,
                                                 "roles" => User::ROLES, "ca_certificate_set" => ldap_ca_certificate.present?)
  end

  private

  def stored_form
    attributes.slice(*PLAIN_FIELDS).merge(
      SECRET_FIELDS.to_h { |name, column| [column, DirectorySecret.encrypt(public_send(name))] }
    ).compact
  end

  def clean_role_groups(value)
    hash = value.respond_to?(:to_unsafe_h) ? value.to_unsafe_h : value.to_h
    hash.to_h.slice(*User::ROLES).transform_values { |groups|
      (groups.is_a?(String) ? groups.split(/\r?\n|;/) : Array(groups)).map { |g| g.to_s.strip }.compact_blank.uniq
    }.compact_blank
  end

  # The address of the provider must be https, except for one on this computer (trying it out).
  def issuer_is_a_safe_address
    uri = URI.parse(oidc_issuer)
    ok = uri.is_a?(URI::HTTPS) || (uri.is_a?(URI::HTTP) && %w[localhost 127.0.0.1 ::1 [::1]].include?(uri.host))
    errors.add(:oidc_issuer, "must be an https address") unless ok && uri.host.present?
  rescue URI::InvalidURIError
    errors.add(:oidc_issuer, "is not a web address")
  end

  def role_groups_are_known
    return if role_groups.is_a?(Hash) && (role_groups.keys.map(&:to_s) - User::ROLES).empty?

    errors.add(:role_groups, "can only name the roles #{User::ROLES.join(', ')}")
  end

  # Turned on, with nobody able to get in? Refuse: a person would sign in just to be turned away.
  def a_way_to_give_roles
    return if default_role.present? || role_groups.values.flatten.any?

    errors.add(:base, "Name the groups for at least one role, or choose a role for everyone who signs in")
  end
end
