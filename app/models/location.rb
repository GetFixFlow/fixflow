class Location < ApplicationRecord
  include Auditable

  acts_as_tenant :organization
  audited
  has_ancestry orphan_strategy: :destroy
  include SiteScoped

  hidden_by_site by: :self

  TYPES = %w[site building floor zone room outdoor].freeze

  belongs_to :organization
  has_many :assets, dependent: :nullify
  has_many :parts, dependent: :nullify
  has_many :site_memberships, foreign_key: :site_id, inverse_of: :site, dependent: :delete_all

  validates :name, presence: true
  validates :location_type, inclusion: { in: TYPES }
  validate :parent_belongs_to_same_organization, if: :parent_id

  scope :by_type, ->(type) { where(location_type: type) }
  # The places that are sites: top-level, and of type site. See SiteAccess.
  scope :sites, -> { roots.where(location_type: "site") }
  scope :ordered, -> { order(:name) }

  def site? = ancestry.blank? && location_type == "site"

  def full_path
    (ancestors.to_a + [ self ]).map(&:name).join(" > ")
  end

  private

  def parent_belongs_to_same_organization
    return unless parent
    errors.add(:parent, "must belong to the same organization") if parent.organization_id != organization_id
  end
end
