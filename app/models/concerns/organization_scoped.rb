module OrganizationScoped
  extend ActiveSupport::Concern

  included do
    belongs_to :organization
    validates  :organization_id, presence: true

    acts_as_tenant :organization
  end
end
