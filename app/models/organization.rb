class Organization < ApplicationRecord
  include OrganizationSettings
  include OrganizationBranding

  has_many :users, dependent: :destroy
  has_many :locations, dependent: :destroy
  has_many :assets, dependent: :destroy
  has_many :work_orders, dependent: :destroy
  has_many :preventive_maintenances, dependent: :destroy
  has_many :vendors, dependent: :destroy # after the work orders above: a vendor with work orders cannot be deleted
  has_many :parts, dependent: :destroy
  has_many :meters, dependent: :destroy
  has_many :iot_rules,         dependent: :destroy
  has_many :sensor_readings,   dependent: :destroy
  has_many :api_keys,          dependent: :destroy
  has_many :activity_logs,     dependent: :delete_all

  validates :name, presence: true
  validates :subdomain, presence: true, uniqueness: true,
    format: { with: /\A[a-z0-9\-]+\z/, message: "only lowercase letters, numbers, and hyphens" }

  store_accessor :settings, :date_format

  # The "getting started" card on the administrator's dashboard has been put away.
  def getting_started_dismissed? = (settings || {})["getting_started_dismissed_at"].present?

  def dismiss_getting_started!
    update!(settings: (settings || {}).merge("getting_started_dismissed_at" => Time.current.iso8601))
  end

  # The mail server saved in the app, or an empty one.
  def smtp_config = SmtpConfig.load(self)

  # Where chat messages go (Slack, Teams...), or an empty one.
  def chat_config = ChatConfig.load(self)

  # Each install serves one company. Setup is complete once that company
  # exists, after which public sign-up is closed.
  def self.setup_complete?
    exists?
  end

  # The install's one company.
  def self.the_company = order(:id).first
end
