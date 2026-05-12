class AttachmentBlueprint < Blueprinter::Base
  identifier :id
  fields :description, :created_at

  field(:content_type) { |a| a.file.attached? ? a.file.content_type : nil }
  field(:filename)     { |a| a.file.attached? ? a.file.filename.to_s : nil }

  field(:url) do |a|
    next nil unless a.file.attached?
    Rails.application.routes.url_helpers.rails_blob_url(a.file, only_path: true)
  end

  field(:user) do |a|
    { id: a.user.id, full_name: a.user.full_name }
  end
end
