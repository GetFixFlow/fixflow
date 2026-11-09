# A report's filters and period kept under a name (Reports, "Save this view"), optionally emailed as a PDF each week to
# chosen managers. Only the reports that can make a PDF can be saved.
class SavedReport < ApplicationRecord
  include Auditable

  acts_as_tenant :organization
  # What the job writes each time it sends is bookkeeping, not an edit by a person.
  audited ignore: %w[last_sent_on last_sent_at last_error]

  # report key => the controller action that makes it (the same one the screen and its Export menu use).
  REPORTS = {
    "work_orders" => { title: "Work orders", controller: "Api::V1::Reports::WorkOrdersController", action: "summary",
path: "work_orders/summary" },
    "asset_health" => { title: "Asset health", controller: "Api::V1::Reports::AssetsController", action: "health",
path: "assets/health" },
    "pm_compliance" => { title: "PM compliance", controller: "Api::V1::Reports::PmController", action: "compliance", path: "pm/compliance" }
  }.freeze
  PERIODS = %w[last_7_days last_30_days last_90_days this_month last_month].freeze
  FILTER_IDS = %w[location_ids asset_ids user_ids].freeze
  FILTER_WORDS = { "priorities" => WorkOrder::PRIORITIES, "sources" => %w[manual pm iot] }.freeze
  MAX_RECIPIENTS = 20

  belongs_to :organization
  belongs_to :user

  normalizes :name, with: ->(text) { text.to_s.squish }

  validates :name, presence: true, length: { maximum: 80 },
                   uniqueness: { scope: %i[organization_id report], case_sensitive: false }
  validates :report, inclusion: { in: REPORTS.keys }
  validates :period, inclusion: { in: PERIODS }
  validates :send_on, inclusion: { in: 0..6 }, allow_nil: true
  validate :recipients_can_see_reports
  validate :somebody_to_send_to, if: :send_on

  scope :ordered, -> { order(Arel.sql("lower(saved_reports.name)")) }
  scope :emailed, -> { where.not(send_on: nil) }

  # The dates a period means on `today` (the company's date), as [from, to]. The last N days are the whole days before
  # today, so a report sent on Monday morning is about a finished week. (Mirrored in apps/web/src/lib/savedReports.ts.)
  def self.range_for(period, today)
    case period
    when "last_7_days"  then [today - 7, today - 1]
    when "last_30_days" then [today - 30, today - 1]
    when "last_90_days" then [today - 90, today - 1]
    when "this_month"   then [today.beginning_of_month, today]
    when "last_month"   then [today.prev_month.beginning_of_month, today.prev_month.end_of_month]
    else raise ArgumentError, "unknown period #{period.inspect}"
    end
  end

  # Only the Filters panel's own lists are kept, and each in the form the reports read.
  def filters=(incoming)
    incoming = incoming.to_unsafe_h if incoming.respond_to?(:to_unsafe_h)
    incoming = {} unless incoming.is_a?(Hash)
    incoming = incoming.stringify_keys
    kept = FILTER_IDS.index_with { |key| Array(incoming[key]).filter_map { |id| Integer(id, exception: false) }.uniq }
    FILTER_WORDS.each { |key, allowed| kept[key] = Array(incoming[key]).map(&:to_s).uniq & allowed }
    super(kept.compact_blank)
  end

  def recipient_ids=(ids)
    super(Array(ids).filter_map { |id| Integer(id, exception: false) }.uniq)
  end

  def title = REPORTS.fetch(report)[:title]

  def recipients = organization.users.where(id: recipient_ids).order(:first_name, :last_name)

  # The people it can really go to: still here, still managers, and not turned off in Settings, Notifications.
  def people_to_email = recipients.managers.wanting_email("report_scheduled")

  # What the report's endpoint is asked, for the company's date `today`.
  def query_for(today)
    from, to = self.class.range_for(period, today)
    { "from" => from.iso8601, "to" => to.iso8601 }.merge(filters)
  end

  private

  def recipients_can_see_reports
    return if recipient_ids.empty?

    errors.add(:recipient_ids, "can have at most #{MAX_RECIPIENTS} people") if recipient_ids.size > MAX_RECIPIENTS
    managers = organization.users.managers.active.where(id: recipient_ids).pluck(:id)
    return if (recipient_ids - managers).empty?

    errors.add(:recipient_ids, "can only be managers and administrators: reports show what work cost, which is made of wages")
  end

  def somebody_to_send_to
    errors.add(:recipient_ids, "need at least one person to email it to") if recipient_ids.empty?
  end
end
