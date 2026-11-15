class ActivityLog < ApplicationRecord
  acts_as_tenant :organization
  self.ignored_columns += ["updated_at"]  # table has no updated_at

  belongs_to :organization
  belongs_to :user, optional: true

  validates :action, presence: true

  # The records that belong to a site, by the name the log keeps for them. What happened to one at a site a person does
  # not work at is not theirs to read (see SiteAccess).
  SITE_RECORDS = %w[WorkOrder Asset Location PreventiveMaintenance IotRule IotAlert Meter AssetDocument AssetDowntime].freeze

  # Without the entries about records at sites the person cannot see; everything for a person who sees every site.
  scope :at_my_sites, lambda {
    next all if Current.hidden_location_ids.blank?

    SITE_RECORDS.inject(where.not(resource_type: SITE_RECORDS)) do |visible, type|
      visible.or(where(resource_type: type, resource_id: type.constantize.select(:id)))
    end
  }

  scope :recent,         ->           { order(created_at: :desc) }
  # What a dashboard shows as "recent activity": the work, not who signed in.
  scope :without_sign_ins, -> { where.not(action: "user.signed_in") }
  scope :for_resource,   ->(type, id) { where(resource_type: type, resource_id: id) }
  scope :since,          ->(time)     { where("created_at >= ?", time) }
  scope :until_time,     ->(time)     { where("created_at <= ?", time) }
  scope :by_action,      ->(action)   { where(action: action) }
  scope :by_resource,    ->(type)     { where(resource_type: type) }
  scope :by_user,        ->(uid)      { where(user_id: uid) }
  scope :with_verb,      ->(verb)     { where("action LIKE ?", "%.#{sanitize_sql_like(verb)}") }
  scope :by_person_named, lambda { |text|
    like = "%#{sanitize_sql_like(text.to_s.strip)}%"
    joins(:user).where("(users.first_name || ' ' || users.last_name) ILIKE :like OR users.email ILIKE :like", like: like)
  }
  scope :named_like,     ->(text)     { where("resource_name ILIKE ?", "%#{sanitize_sql_like(text.to_s.strip)}%") }
end
