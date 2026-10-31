# A model holding one uploaded photo, PDF or Word document: what is accepted, and how big it may be.
module UploadableFile
  extend ActiveSupport::Concern

  MAX_SIZE = 10.megabytes
  ALLOWED_TYPES = %w[
    image/jpeg image/png image/webp image/heic image/heif image/gif
    application/pdf application/msword
    application/vnd.openxmlformats-officedocument.wordprocessingml.document
  ].freeze

  included do
    has_one_attached :file

    validates :file, presence: true
    validate :file_is_acceptable
  end

  class_methods do
    # Whether a file that says it is a photo really is one, judged by its contents, not its name or declared type.
    def photo?(io)
      Marcel::MimeType.for(io).to_s.start_with?("image/")
    ensure
      io.rewind
    end
  end

  private

  def file_is_acceptable
    return unless file.attached?

    errors.add(:file, "must be 10 MB or smaller") if file.blob.byte_size > self.class::MAX_SIZE
    errors.add(:file, "must be a photo, PDF or Word document") unless self.class::ALLOWED_TYPES.include?(file.blob.content_type)
  end
end
