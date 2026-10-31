# A manual, photo or certificate kept with an asset.
class AssetDocument < ApplicationRecord
  include UploadableFile

  belongs_to :asset
  belongs_to :user

  scope :pdfs, -> { joins(file_attachment: :blob).where(active_storage_blobs: { content_type: "application/pdf" }) }
end
