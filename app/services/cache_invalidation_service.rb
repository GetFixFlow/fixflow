class CacheInvalidationService
  def self.invalidate_dashboard(organization_id)
    Rails.cache.delete_matched("dashboard/#{organization_id}/*")
  end

  def self.invalidate_asset_reports(organization_id)
    Rails.cache.delete_matched("reports/asset_health/#{organization_id}*")
  end

  def self.invalidate_pm_reports(organization_id)
    Rails.cache.delete_matched("reports/pm_compliance/#{organization_id}*")
  end

  def self.invalidate_all(organization_id)
    invalidate_dashboard(organization_id)
    invalidate_asset_reports(organization_id)
    invalidate_pm_reports(organization_id)
  end
end
