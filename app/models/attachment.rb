class Attachment < ApplicationRecord
  belongs_to :work_order
  belongs_to :user

  has_one_attached :file

  validates :file, presence: true
end
