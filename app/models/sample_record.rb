class SampleRecord < ApplicationRecord
  belongs_to :organization

  scope :of_type, ->(type) { where(record_type: type.to_s) }

  # The ids of this company's sample records of a kind.
  def self.ids_of(type, organization)
    where(organization: organization).of_type(type).pluck(:record_id)
  end
end
