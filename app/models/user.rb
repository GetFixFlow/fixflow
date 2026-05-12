class User < ApplicationRecord
  include Devise::JWT::RevocationStrategies::JTIMatcher

  ROLES = %w[admin manager technician requester].freeze

  devise :database_authenticatable, :registerable, :recoverable,
    :rememberable, :trackable, :validatable,
    :jwt_authenticatable, jwt_revocation_strategy: self

  belongs_to :organization
  has_many :assigned_work_orders,  class_name: "WorkOrder", foreign_key: :assignee_id,   dependent: :nullify
  has_many :requested_work_orders, class_name: "WorkOrder", foreign_key: :requester_id, dependent: :nullify
  has_many :verified_work_orders,  class_name: "WorkOrder", foreign_key: :verified_by_id, dependent: :nullify
  has_many :comments, dependent: :destroy

  validates :role, inclusion: { in: ROLES }
  validates :first_name, :last_name, presence: true

  scope :by_role, ->(role) { where(role: role) }
  scope :technicians, -> { where(role: "technician") }
  scope :managers, -> { where(role: %w[admin manager]) }

  def full_name
    "#{first_name} #{last_name}".strip
  end

  def admin?
    role == "admin"
  end

  def manager_or_above?
    role.in?(%w[admin manager])
  end
end
