class ActivityLog < ApplicationRecord
  acts_as_tenant :organization
  self.ignored_columns += ["updated_at"]  # table has no updated_at

  belongs_to :organization
  belongs_to :user, optional: true

  validates :action, presence: true

  scope :recent,         ->           { order(created_at: :desc) }
  scope :for_resource,   ->(type, id) { where(resource_type: type, resource_id: id) }
  scope :since,          ->(time)     { where("created_at >= ?", time) }
  scope :until_time,     ->(time)     { where("created_at <= ?", time) }
  scope :by_action,      ->(action)   { where(action: action) }
  scope :by_resource,    ->(type)     { where(resource_type: type) }
  scope :by_user,        ->(uid)      { where(user_id: uid) }
end
