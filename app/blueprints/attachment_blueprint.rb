class AttachmentBlueprint < Blueprinter::Base
  identifier :id
  fields :description, :created_at

  field(:content_type) { |a| a.file.attached? ? a.file.content_type : nil }
  field(:filename)     { |a| a.file.attached? ? a.file.filename.to_s : nil }

  field(:url) do |a|
    next nil unless a.file.attached?
    # Through the app, not a redirect to the file storage: its address is internal (http://s3:8333) and no browser can open it.
    Rails.application.routes.url_helpers.rails_storage_proxy_path(a.file, only_path: true)
  end

  field(:user) do |a|
    { id: a.user.id, full_name: a.user.full_name }
  end
end
