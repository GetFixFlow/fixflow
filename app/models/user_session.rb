# Where a person is signed in: one row for each sign-in (a browser or a phone).
class UserSession < ApplicationRecord
  # How stale last_active_at may get before a request writes it again.
  TOUCH_EVERY = 5.minutes

  belongs_to :user

  validates :sid, :jti, :expires_at, :last_active_at, presence: true

  # Not ended and not expired. Whether the user's jti still matches is checked where it is used.
  scope :live, -> { where(revoked_at: nil).where("expires_at > ?", Time.current) }

  # What a browser says about itself comes from outside: cut to size and made safe to store
  # (the database refuses invalid text and null bytes, which would otherwise stop the sign-in).
  def self.clean_agent(text)
    text.to_s.dup.force_encoding(Encoding::UTF_8).scrub("").delete("\u0000").first(255).presence
  end

  def device = DeviceName.for(user_agent)

  def revoke! = update!(revoked_at: Time.current)
end
