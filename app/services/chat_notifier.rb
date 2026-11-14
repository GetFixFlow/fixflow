# Tells the company's chat channel, and the notification channels plugins add (Plugins::Channels), about something, if the
# administrator set them up and ticked this event. Called from the places that send the emails. Never raises: a chat service
# being down must not break the thing that caused the message.
module ChatNotifier
  def self.post(organization, event, title:, body: nil, path: nil)
    link = path ? "#{EmailSetup.base_url}#{path}" : nil
    queue_chat(organization, event, title, body, link)
    Plugins::Channels.post(organization, event, title: title, body: body, link: link)
  rescue StandardError => e
    Rails.logger.error "[Chat] Could not queue #{event}: #{e.class} — #{e.message}"
  end

  def self.queue_chat(organization, event, title, body, link)
    return unless organization&.chat_config&.active_for?(event)

    ChatMessageJob.perform_later(organization.id, event, title.to_s, body.to_s, link)
  end
  private_class_method :queue_chat
end
