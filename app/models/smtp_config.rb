# The mail server the company's administrator saved in the app. It is kept on the organization
# (the password encrypted) and used for every email the install sends, ahead of the SMTP_*
# settings in the server's environment.
class SmtpConfig
  include ActiveModel::Model
  include ActiveModel::Attributes

  ENCRYPTIONS = %w[none tls ssl].freeze
  FIELDS = %w[host port username encryption from_name from_address].freeze

  attribute :host, :string
  attribute :port, :integer, default: 587
  attribute :username, :string
  attribute :password, :string
  attribute :encryption, :string, default: "tls"
  attribute :from_name, :string
  attribute :from_address, :string

  validates :host, :from_address, presence: true
  validates :port, numericality: { only_integer: true, greater_than: 0, less_than: 65_536 }
  validates :encryption, inclusion: { in: ENCRYPTIONS }
  validates :from_address, format: { with: URI::MailTo::EMAIL_REGEXP }, allow_blank: true

  # What is saved on the organization, or an empty one.
  def self.load(organization)
    saved = (organization&.email_settings || {}).with_indifferent_access
    new(saved.slice(*FIELDS).merge(password: SmtpSecret.decrypt(saved[:password_ciphertext])))
  end

  # Change from form input. A blank password means "keep the one already saved", unless the server is another one: a saved
  # password is never sent to a server it was not given for (the "send a test" button would otherwise carry it to any
  # host typed in), so a new server needs its password typed again.
  def assign(changes)
    changes = changes.to_h.with_indifferent_access
    if changes[:password].blank?
      changes.delete(:password)
      self.password = nil if another_host?(changes[:host], host)
    end
    self.attributes = changes.slice(*FIELDS, "password").transform_values { |v| v.is_a?(String) ? v.strip : v }
    self
  end

  def save_to(organization)
    organization.update!(email_settings: stored_form)
  end

  def another_host?(new_host, old_host)
    new_host.is_a?(String) && !new_host.strip.casecmp?(old_host.to_s.strip)
  end
  private :another_host?

  def configured? = host.present? && from_address.present?
  def password_set? = password.present?

  # The sender shown on every email: "Name <address>".
  def from
    return from_address if from_name.blank?

    Mail::Address.new.tap { |a|
      a.address = from_address
      a.display_name = from_name
    }.to_s
  end

  # In the shape Mail::SMTP wants.
  def to_mail_settings
    {
      address: host,
      port: port,
      domain: URI.parse(EmailSetup.base_url).host,
      user_name: username.presence,
      password: username.present? ? password : nil,
      authentication: username.present? ? :plain : nil,
      tls: encryption == "ssl",                # secure from the first byte, usually port 465
      enable_starttls: encryption == "tls" ? :always : false, # switch to secure after hello, usually port 587
      open_timeout: 8,
      read_timeout: 15
    }.compact
  end

  private

  def stored_form
    attributes.slice(*FIELDS).merge("password_ciphertext" => SmtpSecret.encrypt(password))
  end
end
