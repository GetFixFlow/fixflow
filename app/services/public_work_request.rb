# A maintenance request from someone with no account (the QR label's form). It becomes an ordinary
# work order, so the team handles it like any other, and gets an unguessable link to follow it.
#
# Everything here comes from a stranger: fields are cut to a fixed size, control characters are
# dropped, and the caller cannot choose the priority, the status or the company.
class PublicWorkRequest
  include ActiveModel::Model
  include ActiveModel::Attributes

  # Text with the control characters (and anything that is not valid UTF-8) taken out, newlines and tabs kept.
  class CleanText < ActiveModel::Type::String
    def cast_value(value)
      super.to_s.scrub("").gsub(/[\p{Cc}&&[^\n\t]]/, "").strip.presence
    end
  end

  MAX_NAME        = 100
  MAX_EMAIL       = 254
  MAX_DESCRIPTION = 2000
  MAX_LINE        = 200
  MIN_DESCRIPTION = 10
  TOKEN_BYTES     = 16 # 128 bits, 22 characters

  # What someone outside the team is shown: where the request stands, not how the team labels it.
  PUBLIC_STATUS = {
    "open" => "received", "assigned" => "assigned", "in_progress" => "in_progress",
    "on_hold" => "in_progress", "pending_parts" => "in_progress",
    "completed" => "completed", "verified" => "completed", "cancelled" => "cancelled"
  }.freeze

  attribute :requester_name,       CleanText.new
  attribute :requester_email,      CleanText.new
  attribute :description,          CleanText.new
  attribute :location_description, CleanText.new
  attribute :asset_description,    CleanText.new
  attribute :asset_code,           CleanText.new

  validates :requester_name, presence: true, length: { maximum: MAX_NAME }
  validates :requester_email, length: { maximum: MAX_EMAIL },
                              format: { with: URI::MailTo::EMAIL_REGEXP },
                              allow_nil: true
  validates :description, presence: true, length: { minimum: MIN_DESCRIPTION, maximum: MAX_DESCRIPTION }
  validates :location_description, :asset_description, length: { maximum: MAX_LINE }
  validate  :asset_code_is_known

  # The fields of a request as the status page shows them. No id, work order number, name, email,
  # assignee, comments or costs: whoever holds the link sees this one request's progress and nothing else.
  def self.status_view(work_order)
    {
      token:       work_order.public_token,
      title:       work_order.title,
      description: work_order.description,
      status:      PUBLIC_STATUS.fetch(work_order.status, "received"),
      created_at:  work_order.created_at,
      updated_at:  work_order.updated_at
    }
  end

  def initialize(company, attributes = {})
    @company = company
    super(attributes)
  end

  # The new work order, or false (see #errors).
  def save
    return false unless valid?

    work_order = @company.work_orders.create!(
      title:           description.lines.first.squish.truncate(80),
      description:     body,
      priority:        @company.default_priority,
      due_date:        @company.default_due_days.days.from_now,
      requester_name:  requester_name,
      requester_email: requester_email&.downcase,
      asset:           @asset,
      public_token:    SecureRandom.urlsafe_base64(TOKEN_BYTES)
    )
    NotifyNewRequestJob.perform_later(work_order.id)
    work_order
  end

  private

  def asset_code_is_known
    return if asset_code.blank?

    @asset = @company.assets.kept.find_by(public_code: asset_code)
    errors.add(:asset_code, "is not a known equipment code") unless @asset
  end

  # The description, with the place and equipment the person typed (when they did not scan a label).
  def body
    [
      description,
      ("Location: #{location_description}" if location_description),
      ("Equipment: #{asset_description}" if asset_description && !@asset)
    ].compact.join("\n\n")
  end
end
