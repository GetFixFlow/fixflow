# A person who works at a site (a top-level location of type "site", see SiteAccess). A person with none works across all of
# them; an administrator always does.
class SiteMembership < ApplicationRecord
  belongs_to :user
  belongs_to :site, class_name: "Location"

  validates :site_id, uniqueness: { scope: :user_id }
  validate :site_is_a_site_of_the_company

  private

  def site_is_a_site_of_the_company
    return unless user && site_id

    found = Location.unscoped.find_by(id: site_id, organization_id: user.organization_id)
    errors.add(:site, "must be a site of the same company") unless found&.site?
  end
end
