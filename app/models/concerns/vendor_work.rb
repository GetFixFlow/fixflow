# A work order that an outside company did (or is doing): the vendor, what they charged and their invoice number. The
# vendor is looked up past the tenant scope: another company's vendor would otherwise read as no vendor, and pass.
module VendorWork
  extend ActiveSupport::Concern

  included do
    belongs_to :vendor, optional: true

    validates :vendor_cost, numericality: { greater_than_or_equal_to: 0, less_than: 10**8 }
    validates :vendor_reference, length: { maximum: 80 }
    validate  :vendor_belongs_to_same_org, if: :vendor_id
    validate  :vendor_is_active, if: :will_save_change_to_vendor_id?
  end

  private

  def vendor_belongs_to_same_org
    ours = Vendor.unscoped.exists?(id: vendor_id, organization_id: organization_id)
    errors.add(:vendor, "must belong to the same organization") unless ours
  end

  # Work already given to a vendor goes on after the vendor is switched off; new work cannot be given to it.
  def vendor_is_active
    errors.add(:vendor, "is deactivated and cannot be given new work") if Vendor.unscoped.exists?(id: vendor_id, active: false)
  end
end
