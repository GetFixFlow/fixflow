class SavedReportBlueprint < Blueprinter::Base
  identifier :id
  fields :name, :report, :period, :filters, :send_on, :recipient_ids, :last_sent_on, :last_sent_at, :last_error, :created_at

  field(:title, &:title)
  field(:owner) { |saved| { id: saved.user_id, full_name: saved.user.full_name } }
  field(:recipients) { |saved| saved.recipients.map { |person| { id: person.id, full_name: person.full_name } } }
  # Whether the person asking can change or delete it (pass `viewer:`).
  field(:editable) { |saved, options| options[:viewer].admin? || saved.user_id == options[:viewer].id }
end
