# Puts what people do to the company's records into the audit log (ActivityLog), whoever does it and however: the
# screens, an import, a job. One line for each create, update and delete, naming the person (Current.user; none for
# something the system did) and where they were (Current.request_ip).
#
#   audited ignore: %w[trigger_count last_triggered_at]   # changes to these are not worth a line
#
# An update records which fields changed, never their values (a value can be a wage or a secret), except for the few
# named in `values:`. A model can say more with `audit_update_verb` ("revoked", "deactivated") and `audit_name`.
# Bulk work (an import, demo data) wraps itself in `Auditable.silenced { }` and writes one line for the whole.
module Auditable
  extend ActiveSupport::Concern

  NEVER = %w[created_at updated_at].freeze
  # What the log calls a field, when the column's name would mislead or mean nothing to the person reading.
  LABELS = { "encrypted_password" => "password", "discarded_at" => "deleted" }.freeze

  # Run a block without writing audit lines for the records it touches (the caller writes one line for the whole).
  def self.silenced(&)
    Current.set(audit_silenced: true, &)
  end

  included do
    class_attribute :audit_watch, default: nil # only these fields count; nil: every field but the ignored ones
    class_attribute :audit_ignore, default: []
    class_attribute :audit_values, default: []

    after_commit :audit_create, on: :create
    after_commit :audit_update, on: :update
    after_commit :audit_destroy, on: :destroy
  end

  class_methods do
    def audited(watch: nil, ignore: [], values: [])
      self.audit_watch = watch&.map(&:to_s)
      self.audit_ignore = ignore.map(&:to_s)
      self.audit_values = values.map(&:to_s)
    end
  end

  private

  def audit(verb, metadata = {})
    return if Current.audit_silenced

    ActivityLogService.log(action: "#{self.class.model_name.singular}.#{verb}", resource: self, metadata: metadata)
  end

  def audit_create = audit("created")

  def audit_destroy = audit("deleted")

  def audit_update
    fields = audit_changed_fields
    verb = audit_update_verb
    return if verb.nil? && fields.empty?

    audit(verb || "updated", audit_metadata(fields))
  end

  # A state change that deserves its own word ("revoked", "deactivated"); nil for an ordinary update.
  def audit_update_verb = nil

  def audit_changed_fields
    fields = saved_changes.keys - NEVER - audit_ignore
    fields &= audit_watch if audit_watch
    fields
  end

  def audit_metadata(fields)
    metadata = { changed: fields.map { |field| LABELS.fetch(field, field) } }
    values = fields & audit_values
    metadata[:values] = saved_changes.slice(*values) if values.any?
    metadata
  end
end
