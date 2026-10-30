# The words posted to a chat channel, in the form each kind of chat takes. What comes from outside (a work order's title can be
# typed by anyone through the public request form) is made harmless first: in Slack a "<!channel>" or "<https://evil|text>"
# in a message pings everyone or hides a link, and Teams reads Markdown.
class ChatMessage
  Content = Struct.new(:title, :body, :link, keyword_init: true)

  def initialize(kind, content)
    @kind = kind
    @content = content
  end

  # => the JSON a webhook of this kind takes.
  def payload
    @kind == "teams" ? teams : slack
  end

  def self.slack_escape(text) = text.to_s.gsub("&", "&amp;").gsub("<", "&lt;").gsub(">", "&gt;")

  # Markdown and HTML characters that would turn someone's words into a link or a style are dropped.
  def self.teams_plain(text) = text.to_s.gsub(/[\[\]<>*_`~|]/, "").gsub(/\s+/, " ").strip

  private

  # Slack's incoming webhook, which Mattermost, Rocket.Chat and Discord (at /slack) take too.
  def slack
    lines = ["*#{self.class.slack_escape(@content.title)}*"]
    lines << self.class.slack_escape(@content.body) if @content.body.present?
    lines << "<#{@content.link}|Open in FixFlow>" if @content.link.present?
    { text: lines.join("\n") }
  end

  # A Teams workflow webhook ("Post to a channel when a webhook request is received") takes a message with an Adaptive Card.
  def teams
    body = [{ type: "TextBlock", text: self.class.teams_plain(@content.title), weight: "Bolder", wrap: true }]
    body << { type: "TextBlock", text: self.class.teams_plain(@content.body), wrap: true } if @content.body.present?
    card = { "$schema" => "http://adaptivecards.io/schemas/adaptive-card.json", type: "AdaptiveCard", version: "1.2", body: body }
    card[:actions] = [{ type: "Action.OpenUrl", title: "Open in FixFlow", url: @content.link }] if @content.link.present?
    { type: "message", attachments: [{ contentType: "application/vnd.microsoft.card.adaptive", contentUrl: nil, content: card }] }
  end
end
