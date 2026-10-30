require "rails_helper"

RSpec.describe ChatMessage do
  let(:link) { "https://fixflow.example.com/work-orders/12" }

  def content(**fields)
    described_class::Content.new({ title: "WO-000012 assigned to Ana Perera", body: "Pump 3 is leaking",
  link: link }.merge(fields))
  end

  describe "for Slack (and Mattermost, Rocket.Chat)" do
    def slack(**fields) = described_class.new("slack", content(**fields)).payload[:text]

    it "is a bold title, the words, and a link back" do
      expect(slack).to eq("*WO-000012 assigned to Ana Perera*\nPump 3 is leaking\n<#{link}|Open in FixFlow>")
    end

    it "makes what people typed harmless: no mentions of everyone, no hidden links, no markup" do
      text = slack(body: "<!channel> <!here> <https://evil.example/phish|Click for your bonus> <@U123> & more")

      ["<!channel>", "<!here>", "<https://evil", "<@U123>"].each { |dangerous| expect(text).not_to include(dangerous) }
      expect(text).to include("&lt;!channel&gt;", "&lt;https://evil.example/phish|Click for your bonus&gt;", "&amp; more")
      expect(text.scan("<").size).to eq(1) # only FixFlow's own link
    end

    it "leaves out the body and the link when there are none" do
      expect(described_class.new("slack", content(body: nil, link: nil)).payload[:text]).to eq("*WO-000012 assigned to Ana Perera*")
    end
  end

  describe "for Microsoft Teams" do
    def card(**fields) = described_class.new("teams", content(**fields)).payload

    it "is a message holding an Adaptive Card with the title, the words and a button back" do
      payload = card

      expect(payload[:type]).to eq("message")
      attachment = payload[:attachments].first
      expect(attachment[:contentType]).to eq("application/vnd.microsoft.card.adaptive")
      body = attachment[:content][:body]
      expect(body.pluck(:text)).to eq(["WO-000012 assigned to Ana Perera", "Pump 3 is leaking"])
      expect(attachment[:content][:actions]).to eq([{ type: "Action.OpenUrl", title: "Open in FixFlow", url: link }])
      expect(attachment[:content]).to include(type: "AdaptiveCard", version: "1.2")
    end

    it "drops the characters that would turn what people typed into a link or a style" do
      text = card(body: "[Click here](https://evil.example) **bold** `code` <b>x</b> ~~gone~~").dig(:attachments, 0, :content, :body,
1, :text)

      expect(text).not_to match(/[\[\]<>*`~]/)
      expect(text).to include("Click here", "bold", "code")
    end
  end
end
