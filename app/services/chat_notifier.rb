# Tells the company's chat channel about something, if the administrator set one up and ticked this event. Called from the
# places that send the emails. Never raises: a chat service being down must not break the thing that caused the message.
module ChatNotifier
  def self.post(organization, event, title:, body: nil, path: nil)
    return unless organization&.chat_config&.active_for?(event)

    link = path ? "#{EmailSetup.base_url}#{path}" : nil
    ChatMessageJob.perform_later(organization.id, event, title.to_s, body.to_s, link)
  rescue StandardError => e
    Rails.logger.error "[Chat] Could not queue #{event}: #{e.class} — #{e.message}"
  end
end
