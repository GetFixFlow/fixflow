class Attachment < ApplicationRecord
  include UploadableFile

  belongs_to :work_order
  belongs_to :user
end
