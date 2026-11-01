# A field an administrator added to work orders or parts. The values live on the record (HasCustomValues); this says
# what the field is called, what it accepts and where it shows.
class CustomField < ApplicationRecord
  include Auditable

  acts_as_tenant :organization
  audited

  ENTITIES = %w[work_order part].freeze
  KINDS = %w[text number date select checkbox].freeze
  MAX_PER_ENTITY = 20
  MAX_OPTIONS = 50
  TEXT_LENGTH = 500
  NUMBER_LIMIT = 10**12

  belongs_to :organization

  normalizes :label, with: ->(text) { text.to_s.squish }

  before_validation :make_key, on: :create
  before_validation :tidy_options
  after_destroy :remove_values

  validates :entity, inclusion: { in: ENTITIES }
  validates :kind, inclusion: { in: KINDS }
  validates :label, presence: true, length: { maximum: 60 }
  validates :key, presence: true,
                  uniqueness: { scope: %i[organization_id entity], message: "is taken: another field has a very similar name" } # rubocop:disable Rails/I18nLocaleTexts
  validate :options_fit_kind
  validate :checkbox_is_never_required
  validate :key_and_kind_stay, on: :update
  validate :room_for_another, on: :create

  scope :active, -> { where(active: true) }
  scope :ordered, -> { order(:entity, :position, :id) }

  def self.model_for(entity) = entity == "part" ? Part : WorkOrder

  # What to store for a value someone entered, or nil to store nothing (an empty value is no value). Raises
  # ArgumentError, with a sentence to show, for one this field cannot take.
  def cast(value)
    return nil if value.nil? || (value.is_a?(String) && value.strip.empty?)

    case kind
    when "text"     then cast_text(value)
    when "number"   then cast_number(value)
    when "date"     then cast_date(value)
    when "select"   then cast_option(value)
    when "checkbox" then cast_checkbox(value)
    end
  end

  # How a stored value reads in a spreadsheet or a sentence.
  def display(value)
    return "" if value.nil?
    return value.to_s unless kind == "checkbox"

    value ? "Yes" : "No"
  end

  private

  def cast_text(value)
    raise ArgumentError, "must be text" unless value.is_a?(String)

    text = value.strip
    raise ArgumentError, "is too long (at most #{TEXT_LENGTH} characters)" if text.length > TEXT_LENGTH

    text
  end

  def cast_number(value)
    raise ArgumentError, "must be a number" unless value.is_a?(Numeric) || value.is_a?(String)

    number = BigDecimal(value.to_s.strip, exception: false)
    raise ArgumentError, "must be a number" unless number&.finite?
    raise ArgumentError, "is too large" if number.abs >= NUMBER_LIMIT

    number.frac.zero? ? number.to_i : number.to_f
  end

  def cast_date(value)
    Date.iso8601(value.to_s.strip).iso8601
  rescue Date::Error
    raise ArgumentError, "must be a date"
  end

  def cast_option(value)
    text = value.to_s.strip
    raise ArgumentError, "must be one of: #{options.join(', ')}" unless options.include?(text)

    text
  end

  def cast_checkbox(value)
    return value if [true, false].include?(value)

    case value.to_s.strip.downcase
    when "true"  then true
    when "false" then false
    else raise ArgumentError, "must be yes or no"
    end
  end

  # "Cost centre" becomes cost_centre. A label in a script that has no Latin letters ("කොටස") gets a made-up key; the
  # label is what people see.
  def make_key
    return if key.present?

    slug = label.to_s.parameterize(separator: "_").tr("-", "_").squeeze("_").first(40)
    self.key = slug.presence || "field_#{SecureRandom.hex(3)}"
  end

  def tidy_options
    self.options = kind == "select" ? Array(options).map { |option| option.to_s.squish }.compact_blank.uniq : []
  end

  # What was filled in for a field goes with it (turning the field off keeps it).
  def remove_values
    self.class.model_for(entity).unscoped.where(organization_id: organization_id).where("custom_values ->> ? IS NOT NULL", key)
        .update_all(["custom_values = custom_values - ?::text", key]) # rubocop:disable Rails/SkipsModelValidations
  end

  def options_fit_kind
    return unless kind == "select"

    errors.add(:options, "need at least one choice") if options.empty?
    errors.add(:options, "can have at most #{MAX_OPTIONS} choices") if options.size > MAX_OPTIONS
    errors.add(:options, "must each be 100 characters or fewer") if options.any? { |option| option.length > 100 }
  end

  def checkbox_is_never_required
    errors.add(:required, "does not apply to a yes/no box: leaving it empty is a no") if kind == "checkbox" && required
  end

  def key_and_kind_stay
    errors.add(:kind, "cannot be changed: delete the field and add it again") if kind_changed?
    errors.add(:key, "cannot be changed") if key_changed?
    errors.add(:entity, "cannot be changed") if entity_changed?
  end

  def room_for_another
    return unless organization && ENTITIES.include?(entity)
    return if organization.custom_fields.where(entity: entity).count < MAX_PER_ENTITY

    errors.add(:base, "There can be at most #{MAX_PER_ENTITY} custom fields on #{entity.humanize.downcase.pluralize}")
  end
end
