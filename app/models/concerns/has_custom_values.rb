# What was filled in for the company's custom fields (CustomField), kept in `custom_values` as { "field_key" => value }.
#
# * Assigning merges: the keys sent replace those keys, the others stay, and an empty value clears its key. A form
#   that sends only some fields cannot wipe the rest.
# * A value is checked against its field only when it changes, so a field that was edited or turned off later never
#   blocks an unrelated change to an old record (a status change, say).
# * Required fields are enforced only where a person fills in the form (set `require_custom_values`), not for work
#   that is made by a job, a QR label or the public request page, which have nowhere to fill them in.
module HasCustomValues
  extend ActiveSupport::Concern

  included do
    attr_accessor :require_custom_values

    before_validation :tidy_custom_values, if: :custom_values_changed?
    validate :custom_values_fit_fields, if: -> { custom_values_changed? || require_custom_values }
  end

  def custom_values=(incoming)
    incoming = incoming.to_unsafe_h if incoming.respond_to?(:to_unsafe_h)
    incoming = {} unless incoming.is_a?(Hash)
    super((self[:custom_values] || {}).merge(incoming.stringify_keys))
  end

  def custom_entity = self.class.model_name.singular

  # The fields whose values the last save changed (for the audit log, which never records what was typed).
  def custom_field_keys_changed
    old, new = saved_change_to_custom_values
    (old.keys | new.keys).reject { |key| old[key] == new[key] } if old
  end

  private

  def custom_fields_by_key
    @custom_fields_by_key ||= organization.custom_fields.where(entity: custom_entity).index_by(&:key)
  end

  # Empty values go; what stays is in the form the field stores it. A value its field refuses is left as it is, for
  # the validation to name.
  def tidy_custom_values
    @custom_fields_by_key = nil
    cleaned = custom_values.to_h { |key, value| [key, tidy_value(custom_fields_by_key[key], value)] }.compact
    self[:custom_values] = cleaned if cleaned != custom_values
  end

  def tidy_value(field, value)
    field ? field.cast(value) : value
  rescue ArgumentError
    value
  end

  def custom_values_fit_fields
    before = custom_values_in_database || {}
    custom_values.each do |key, value|
      next if before[key] == value

      field = custom_fields_by_key[key]
      next errors.add(:base, "There is no custom field “#{key}”") unless field
      next errors.add(:base, "#{field.label} is turned off") unless field.active

      field.cast(value)
    rescue ArgumentError => e
      errors.add(:base, "#{field.label} #{e.message}")
    end
    check_required_custom_values if require_custom_values
  end

  def check_required_custom_values
    custom_fields_by_key.each_value do |field|
      errors.add(:base, "#{field.label} is required") if field.active && field.required && custom_values[field.key].nil?
    end
  end
end
