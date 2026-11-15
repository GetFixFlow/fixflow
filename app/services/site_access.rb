# Who sees which sites. A site is a top-level location of type "site". Sites are opt-in: until an administrator switches them on
# (Settings, Sites) nothing here has any effect, so an install that already has locations of that type is not changed.
#
# Once on, a person who is not an administrator and who is assigned to one or more sites sees only those sites' places, assets,
# work orders, preventive maintenance, sensors and what hangs off them, plus anything that is not in any site (shared by every
# site). A person assigned to no site, and every administrator, sees everything. Vendors and people are company-wide.
#
# What is hidden is worked out once for a request (Current.hidden_location_ids) and applied by default scopes (SiteScoped), so
# every way of reaching a record is covered, not just the lists.
module SiteAccess
  # The ids of the locations this person may not see, or nil when they see everything.
  def self.hidden_location_ids(user)
    return unless user && !user.admin? && user.organization&.sites_enabled?

    mine = SiteMembership.where(user_id: user.id).pluck(:site_id)
    return if mine.empty?

    places = Location.unscoped.where(organization_id: user.organization_id).pluck(:id, :ancestry, :location_type)
    sites = places.select { |_id, ancestry, type| ancestry.blank? && type == "site" }.map(&:first)
    others = sites - mine
    places.filter_map { |id, ancestry, _type| id if others.include?(root_of(id, ancestry)) }
  end

  # The site a location is in (the id of its top-level location when that is a site), or nil.
  def self.site_id_for(location)
    return unless location

    root = location.ancestry.blank? ? location : Location.unscoped.find_by(id: location.ancestry.split("/").first)
    root.id if root&.site?
  end

  # The time zone for a person: their first site's own, when it has one; else the company's.
  def self.time_zone(user)
    organization = user&.organization
    return organization&.timezone_or_default || "UTC" unless organization&.sites_enabled? && !user.admin?

    first = SiteMembership.where(user_id: user.id).order(:id).first&.site
    SiteSettings.for(first)["timezone"] || organization.timezone_or_default
  end

  def self.root_of(id, ancestry) = (ancestry.presence&.split("/")&.first || id).to_i
  private_class_method :root_of
end
