# A browser or phone that asked to be pushed to. See PushNotifier.
class PushSubscription < ApplicationRecord
  MAX_PER_USER = 10
  # The push service refusing this many messages in a row (not "gone", which removes it at once) removes the row.
  MAX_FAILURES = 5

  belongs_to :user

  validates :endpoint, :p256dh, :auth, presence: true
  validates :endpoint, uniqueness: true
  validate :endpoint_is_a_push_service
  validate :keys_are_the_right_size
  validate :user_has_room, on: :create

  # What a browser says about itself comes from outside: cut to size and made safe to store.
  def self.clean_agent(text) = UserSession.clean_agent(text)

  def device = DeviceName.for(user_agent)

  private

  def endpoint_is_a_push_service
    problem = PushEndpoint.problem(endpoint) if endpoint.present?
    errors.add(:endpoint, problem) if problem
  end

  # The browser's public key is an uncompressed P-256 point (65 bytes), the auth secret 16 bytes: urlsafe base64.
  def keys_are_the_right_size
    errors.add(:p256dh, "is not a push key") unless decoded_size(p256dh) == 65
    errors.add(:auth, "is not a push secret") unless decoded_size(auth) == 16
  end

  def decoded_size(text)
    Base64.urlsafe_decode64(text.to_s).bytesize
  rescue ArgumentError
    nil
  end

  def user_has_room
    return unless user && user.push_subscriptions.count >= MAX_PER_USER
    errors.add(:base,
"This account already has #{MAX_PER_USER} devices. Turn one off first.")
  end
end
