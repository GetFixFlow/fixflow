class ActivityLog < ApplicationRecord
  acts_as_tenant :organization
  self.ignored_columns += ["updated_at"]  # table has no updated_at

  belongs_to :organization
  belongs_to :user, optional: true

  validates :action, presence: true

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
