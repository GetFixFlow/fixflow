# Pushes one notification to a person's browsers. Its own job so that the request or the job that caused it never waits
# for a push service, and a slow one holds up only this.
class PushNotificationJob < ApplicationJob
  queue_as :notifications

  def perform(user_id, title:, body:, url:, tag:)
    user = User.find_by(id: user_id)
    return unless user&.active?

    PushNotifier.new.deliver(user, PushNotifier::Message.new(title: title, body: body, url: url, tag: tag))
  end
end
