class Location < ApplicationRecord
  has_ancestry orphan_strategy: :destroy

  TYPES = %w[site building floor zone room outdoor].freeze

  belongs_to :organization
  has_many :assets, dependent: :nullify
  has_many :parts, dependent: :nullify

  validates :name, presence: true
  validates :location_type, inclusion: { in: TYPES }
  validate :parent_belongs_to_same_organization, if: :parent_id

  scope :by_type, ->(type) { where(location_type: type) }
  scope :ordered, -> { order(:name) }

  def full_path
    (ancestors.to_a + [ self ]).map(&:name).join(" > ")
  end

  private

  def parent_belongs_to_same_organization
    return unless parent
    errors.add(:parent, "must belong to the same organization") if parent.organization_id != organization_id
  end
end
