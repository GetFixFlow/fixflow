# A request to buy parts, and the order that follows it. Anyone who works on equipment can ask; a manager approves or
# turns it down, places the order with a vendor, and says what has arrived. Receiving adds to the stock on hand.
class PurchaseOrder < ApplicationRecord
  include AASM
  include Auditable

  acts_as_tenant :organization
  # Moving along (approved, ordered, received...) is logged by the step itself, with what it did; an update is only an
  # edit of what is wanted.
  audited watch: %w[vendor_id reason notes supplier_reference expected_on]

  STATUSES = %w[requested approved ordered partially_received received rejected cancelled].freeze

  belongs_to :organization
  belongs_to :vendor, optional: true
  belongs_to :requested_by, class_name: "User", optional: true
  belongs_to :decided_by, class_name: "User", optional: true
  has_many :lines, -> { order(:id) }, class_name: "PurchaseOrderLine", dependent: :destroy, autosave: true,
                   inverse_of: :purchase_order

  before_validation { self.supplier_reference = supplier_reference.to_s.strip.presence }
  before_create :generate_number

  validates :status, inclusion: { in: STATUSES }
  validates :reason, :notes, :rejection_reason, length: { maximum: 2_000 }
  validates :supplier_reference, length: { maximum: 80 }
  validate  :at_least_one_line
  validate  :vendor_belongs_to_same_org, if: :vendor_id
  validate  :vendor_is_active, if: :will_save_change_to_vendor_id?
  validate  :one_line_for_each_part

  aasm column: :status, whiny_transitions: false do
    state :requested, initial: true
    state :approved
    state :ordered
    state :partially_received
    state :received
    state :rejected
    state :cancelled

    event :approve do
      transitions from: :requested, to: :approved
    end

    event :reject do
      transitions from: :requested, to: :rejected
    end

    event :place_order do
      transitions from: :approved, to: :ordered, guard: :vendor_chosen?
      before { self.ordered_at = Time.current }
    end

    # The rest of the order is not coming: close it as it stands.
    event :close do
      transitions from: :partially_received, to: :received
      before { self.received_at = Time.current }
    end

    event :cancel do
      transitions from: %i[requested approved ordered], to: :cancelled
    end
  end

  scope :waiting_for_approval, -> { where(status: "requested") }
  scope :open, -> { where(status: %w[requested approved ordered partially_received]) }

  # Whether the lines and the vendor may still be changed: nothing has been bought yet.
  def editable? = requested? || approved?

  def total = lines.sum { |line| line.total || 0 }

  # Says that these have arrived ({ line id => quantity }): the stock goes up by each, under the part's row lock, and the
  # order is received when nothing is outstanding, partly received until then. Returns what came in, as (part, quantity).
  def receive!(quantities)
    raise ArgumentError, "Cannot receive an order that is #{status.humanize.downcase}." unless ordered? || partially_received?

    arrived = []
    transaction do
      lines.each do |line|
        quantity = quantities[line.id].to_d
        next unless quantity.positive?
        raise ArgumentError, "#{line.part.name}: only #{line.outstanding.to_f} still to come." if quantity > line.outstanding

        line.part.adjust_stock(quantity, direction: :add)
        line.update!(quantity_received: line.quantity_received + quantity)
        arrived << { part: line.part.name, quantity: quantity.to_f }
      end
      raise ArgumentError, "Enter how many of at least one part have arrived." if arrived.empty?

      all_in = lines.reload.all? { |line| line.outstanding.zero? }
      update!(status: all_in ? "received" : "partially_received", received_at: all_in ? Time.current : nil)
    end
    arrived
  end

  private

  def vendor_chosen? = vendor_id.present?

  def generate_number
    return if number.present?

    last = PurchaseOrder.unscoped.where(organization_id: organization_id)
                        .maximum(Arel.sql("CAST(NULLIF(substring(number from '[0-9]+$'), '') AS bigint)"))
    self.number = format("PO-%<seq>06d", seq: last.to_i + 1)
  end

  def vendor_belongs_to_same_org
    ours = Vendor.unscoped.exists?(id: vendor_id, organization_id: organization_id)
    errors.add(:vendor, "must belong to the same organization") unless ours
  end

  def vendor_is_active
    errors.add(:vendor, "is deactivated and cannot be given new orders") if Vendor.unscoped.exists?(id: vendor_id, active: false)
  end

  def kept_lines = lines.reject(&:marked_for_destruction?)

  def at_least_one_line
    errors.add(:lines, "must have at least one part") if kept_lines.empty?
  end

  def one_line_for_each_part
    parts = kept_lines.map(&:part_id)
    errors.add(:lines, "list the same part twice") if parts.uniq.size != parts.size
  end
end
