require "web-push"

# Sends a notification to every browser a person has turned push on in. A push is encrypted for one browser, signed with
# this server's VAPID keys (PushKeys) and posted to the address that browser's vendor gave it (Chrome: Google's, Firefox:
# Mozilla's, Safari: Apple's). No account with anyone is needed for that.
class PushNotifier
  # What a push may say. The service workers shows it as it comes; the url opens when it is tapped.
  Message = Struct.new(:title, :body, :url, :tag, keyword_init: true)

  TTL = 1.day.to_i # a phone that is off for longer than this misses it; an assignment that old is not news
  OPEN_TIMEOUT = 5
  READ_TIMEOUT = 10
  # Gone for good: the browser's vendor says the subscription was cancelled, never existed, or was made under other keys.
  GONE = [WebPush::ExpiredSubscription, WebPush::InvalidSubscription, WebPush::Unauthorized].freeze

  Result = Struct.new(:sent, :removed, :failed, keyword_init: true)

  def initialize(vapid: PushKeys.vapid)
    @vapid = vapid
  end

  def deliver(user, message)
    result = Result.new(sent: 0, removed: 0, failed: 0)
    user.push_subscriptions.find_each { |subscription| deliver_to(subscription, message, result) }
    result
  end

  private

  def deliver_to(subscription, message, result)
    unless PushEndpoint.safe?(subscription.endpoint)
      subscription.destroy
      result.removed += 1
      return
    end

    WebPush.payload_send(
      message: payload(message), endpoint: subscription.endpoint, p256dh: subscription.p256dh, auth: subscription.auth,
      vapid: @vapid, ttl: TTL, urgency: "normal", open_timeout: OPEN_TIMEOUT, read_timeout: READ_TIMEOUT
    )
    subscription.update_columns(last_sent_at: Time.current, failures: 0) # rubocop:disable Rails/SkipsModelValidations -- bookkeeping, no validation (it would look the address up again)
    result.sent += 1
  rescue *GONE => e
    Rails.logger.info "[Push] Removing subscription #{subscription.id}: #{e.class.name.demodulize}"
    subscription.destroy
    result.removed += 1
  rescue StandardError => e
    Rails.logger.warn "[Push] Could not push to subscription #{subscription.id}: #{e.class} — #{e.message.to_s.truncate(200)}"
    failed(subscription, result)
  end

  def failed(subscription, result)
    result.failed += 1
    subscription.increment!(:failures) # rubocop:disable Rails/SkipsModelValidations -- as above
    subscription.destroy if subscription.failures >= PushSubscription::MAX_FAILURES
  end

  # Kept small: a push service refuses a body over about 4 KB, and a notification is a line or two.
  def payload(message)
    { title: message.title.to_s.truncate(100), body: message.body.to_s.truncate(240), url: message.url.to_s.truncate(500),
      tag: message.tag.to_s.truncate(60) }.to_json
  end
end
