# Where the company's chat messages go (Slack, Microsoft Teams, or anything that takes a Slack-style incoming webhook,
# such as Mattermost and Rocket.Chat), and which events are posted. Kept on the organization; the webhook address, which
# is a secret, is encrypted.
class ChatConfig
  include ActiveModel::Model
  include ActiveModel::Attributes

  KINDS = %w[slack teams].freeze
  # The events a channel can be told about, and the words for them on the settings screen.
  EVENTS = {
    "wo_new_request" => "Someone reports a problem from a QR label",
    "wo_assigned" => "A work order is assigned",
    "wo_needs_verification" => "Work is finished and needs verifying",
    "iot_alert" => "A critical or high sensor alert is raised",
    "part_low_stock" => "A part is running low or out",
    "po_requested" => "Someone asks for parts to be bought",
    "warranty_expiring" => "A warranty ends within 30 days",
    "wo_approval_needed" => "A work order is over the approval limit and needs approving"
  }.freeze
  FIELDS = %w[kind enabled events last_sent_at last_error].freeze

  attribute :kind, :string, default: "slack"
  attribute :enabled, :boolean, default: false
  attribute :events, default: -> { EVENTS.keys }
  attribute :url, :string
  attribute :last_sent_at, :string
  attribute :last_error, :string

  validates :kind, inclusion: { in: KINDS }
  validate :events_are_known
  validate :url_is_a_chat_address, if: -> { url.present? }
  validate :url_is_there_when_enabled

  def self.load(organization)
    saved = (organization&.chat_settings || {}).with_indifferent_access
    new(saved.slice(*FIELDS).merge(url: ChatSecret.decrypt(saved[:url_ciphertext])))
  end

  # Change from form input. A blank address means "keep the one already saved".
  def assign(changes)
    changes = changes.to_h.with_indifferent_access
    changes.delete(:url) if changes[:url].blank?
    self.kind = changes[:kind] if changes.key?(:kind)
    self.enabled = changes[:enabled] if changes.key?(:enabled)
    self.events = Array(changes[:events]).map(&:to_s) if changes.key?(:events)
    self.url = changes[:url].to_s.strip if changes.key?(:url)
    self
  end

  def save_to(organization)
    organization.update!(chat_settings: stored_form)
  end

  def url_set? = url.present?
  def active_for?(event) = enabled && url_set? && events.include?(event.to_s)

  # Where the messages go, without the secret part of the address: enough to recognise it on the screen.
  def url_hint
    URI.parse(url).host if url_set?
  rescue URI::InvalidURIError
    nil
  end

  private

  def stored_form
    attributes.slice(*FIELDS).merge("events" => events, "url_ciphertext" => ChatSecret.encrypt(url))
  end

  def events_are_known
    unknown = events - EVENTS.keys
    errors.add(:events, "include #{unknown.join(', ')}, which FixFlow does not post") if unknown.any?
  end

  def url_is_a_chat_address
    problem = ChatAddress.problem(url)
    errors.add(:url, problem) if problem
  end

  def url_is_there_when_enabled
    errors.add(:url, "is needed to turn chat messages on") if enabled && url.blank?
  end
end
