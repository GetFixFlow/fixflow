# A sample plugin that adds a NOTIFICATION CHANNEL: it sends what FixFlow announces (a work order assigned, a sensor alert, a part
# running low...) to an ntfy topic (https://ntfy.sh, which can also run on your own server) so it arrives as a push on a phone.
# Copy this folder into plugins/ to use it (docs/plugins.md explains each line).
#
# The `fields` become the form on Settings, Plugins: the plugin has no screen of its own. A field of kind "secret" is kept
# encrypted and never shown again. The block runs in the background (never while someone waits) once for each message.
Plugins.define "ntfy" do
  title "ntfy"
  version "1.0.0"
  summary "Sends notifications to an ntfy topic, to read as a push message on a phone."
  author "FixFlow"
  api 1

  channel "ntfy", title: "ntfy topic",
                  summary: "Anyone who knows the topic name can read what is sent to it: use a long name nobody could guess.",
                  fields: [
                    { key: "server", label: "Server", kind: "url", default: "https://ntfy.sh",
                      help: "https://ntfy.sh, or the address of your own ntfy server." },
                    { key: "topic", label: "Topic", required: true, help: "For example: workshop-7f3a9c2e1b" },
                    { key: "token", label: "Access token", kind: "secret", help: "Only for a topic that needs a login." },
                    { key: "priority", label: "Priority", kind: "select", options: %w[default high urgent], default: "default" }
                  ] do |message, settings|
    priority = { "default" => 3, "high" => 4, "urgent" => 5 }.fetch(settings[:priority], 3)
    body = { topic: settings[:topic], title: message.title, message: message.body.presence || message.title, priority: priority,
             tags: ["wrench"] }
    body[:click] = message.link if message.link
    headers = settings[:token].present? ? { "Authorization" => "Bearer #{settings[:token]}" } : {}

    # Plugins::Http checks the address, pins the connection to it, follows no redirects, and turns a 5xx into "try again later" and
    # a 4xx into "this will never work" for FixFlow to show the administrator.
    Plugins::Http.post(settings[:server], json: true, body: body, headers: headers)
  end
end
