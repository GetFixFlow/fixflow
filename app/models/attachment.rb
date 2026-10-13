class Attachment < ApplicationRecord
  MAX_SIZE = 10.megabytes
  ALLOWED_TYPES = %w[
    image/jpeg image/png image/webp image/heic image/heif image/gif
    application/pdf application/msword
    application/vnd.openxmlformats-officedocument.wordprocessingml.document
  ].freeze

  belongs_to :work_order
  belongs_to :user

  has_one_attached :file

  validates :file, presence: true
  validate :file_is_acceptable

  # Whether a file that says it is a photo really is one, judged by its contents, not its name or declared type.
  def self.photo?(io)
    Marcel::MimeType.for(io).to_s.start_with?("image/")
  ensure
    io.rewind
  end

  private

  def file_is_acceptable
    return unless file.attached?

    errors.add(:file, "must be 10 MB or smaller") if file.blob.byte_size > MAX_SIZE
    errors.add(:file, "must be a photo, PDF or Word document") unless ALLOWED_TYPES.include?(file.blob.content_type)
  end
end
