# Active Storage ships two routes that let anyone start an upload with no sign-in: POST /api/v1/storage/direct_uploads, which
# records a file and hands back a signed address to write it to (the bucket, or this server's disk), and PUT
# /api/v1/storage/disk/:token, which accepts the bytes for the disk. FixFlow does not use direct uploads: photos and documents are
# sent to its own controllers, which check who is asking, the type and the size. Left open, a stranger could fill the
# storage. Downloads (GET) stay: they need a signed link, which expires (config.active_storage.urls_expire_in).
# spec/config/storage_routes_spec.rb keeps it so.
Rails.application.config.to_prepare do
  ActiveStorage::DirectUploadsController.before_action { head :not_found }
  ActiveStorage::DiskController.before_action(only: :update) { head :not_found }
end
