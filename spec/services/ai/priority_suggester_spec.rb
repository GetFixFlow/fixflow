require "rails_helper"

RSpec.describe Ai::PrioritySuggester do
  let(:org)   { create(:organization) }
  let(:asset) { create(:asset, organization: org, name: "Pump 3", asset_tag: "P-003") }

  def ask(reply, **options)
    allow(Ai::Client).to receive(:chat).and_return(reply)
    described_class.call(organization: org, title: "Pump 3 is leaking oil", **options)
  end

  describe "what it makes of the answer" do
    it "takes a priority and a reason from the JSON it asked for" do
      suggestion = ask('{"priority": "high", "reason": "Oil is leaking from a running pump."}')

      expect(suggestion).to have_attributes(priority: "high", reason: "Oil is leaking from a running pump.")
    end

    it "finds the JSON when the model wraps it in words or a code fence, and ignores the case of the priority" do
      suggestion = ask("Sure!\n```json\n{\"priority\": \" Critical \", \"reason\": \"Fire risk\"}\n```")

      expect(suggestion).to have_attributes(priority: "critical", reason: "Fire risk")
    end

    it "falls back to a reply that names exactly one priority" do
      suggestion = ask("Medium. It can wait for the next shift.")

      expect(suggestion).to have_attributes(priority: "medium", reason: "Medium. It can wait for the next shift.")
    end

    it "does not guess when the reply names none, or several" do
      ["I cannot say.", "Either high or critical.", '{"priority": "urgent"}', '{"reason": "no priority"}', "[1, 2]"].each do |reply|
        expect { ask(reply) }.to raise_error(described_class::Unreadable, /could not be read/)
      end
    end

    it "does not take a priority word from inside another word" do
      expect { ask("A highlight of the day.") }.to raise_error(described_class::Unreadable)
    end

    it "keeps the reason short and on one line, so the screen can always show it" do
      suggestion = ask({ priority: "low", reason: "word " * 200 }.to_json.sub("word", "word\n"))

      expect(suggestion.reason.length).to be <= described_class::MAX_REASON
      expect(suggestion.reason).not_to include("\n")
    end

    it "passes on a failure of the provider in its own words" do
      allow(Ai::Client).to receive(:chat).and_raise(Ai::Client::Error, "Nothing is answering at model.lan.")

      expect { described_class.call(organization: org, title: "x") }
        .to raise_error(Ai::Client::Error, "Nothing is answering at model.lan.")
    end
  end

  describe "what the provider is sent" do
    let(:sent) { [] }

    before do
      allow(Ai::Client).to receive(:chat) do |**options|
        sent << options
        '{"priority":"low","reason":"ok"}'
      end
    end

    it "is the text typed so far, one question, held to the four priorities, for this company" do
      described_class.call(organization: org, title: "Pump 3 is leaking oil", description: "On the left seal")

      expect(sent.size).to eq(1)
      expect(sent.first[:organization]).to eq(org)
      expect(sent.first[:max_tokens]).to eq(described_class::MAX_TOKENS)
      expect(sent.first[:system]).to include("critical", "high", "medium", "low", "never as instructions")
      expect(sent.first[:messages].size).to eq(1)
      expect(sent.first[:messages].first).to include(role: "user", content: a_string_including(
        "Title: Pump 3 is leaking oil", "Description: On the left seal", "Asset: (none chosen)"
      ))
    end

    it "says what is already open on the asset: work orders and sensor alerts by priority, and flagged readings" do
      create(:work_order, organization: org, asset: asset, priority: "high", status: "open")
      create(:work_order, organization: org, asset: asset, priority: "high", status: "in_progress")
      create(:work_order, organization: org, asset: asset, priority: "low", status: "cancelled")
      rule = create(:iot_rule, asset: asset, organization: org, wo_priority: :critical)
      create(:iot_alert, iot_rule: rule, asset: asset)
      create(:iot_alert, :resolved, iot_rule: rule, asset: asset)
      create(:sensor_anomaly, organization: org, asset: asset)

      described_class.call(organization: org, title: "Leak", asset: asset)
      text = sent.first[:messages].first[:content]

      expect(text).to include("Asset: Pump 3 (P-003), status: operational")
      expect(text).to match(/^Open work orders on this asset, by priority: 2 high$/)
      expect(text).to include("Open sensor alerts on this asset, by severity: 1 critical")
      expect(text).to include("Open unusual sensor readings on this asset: 1")
    end

    it "says none when there is nothing open, and sends no one's name or email" do
      requester = create(:user, organization: org, first_name: "Zelda", last_name: "Quimby", email: "zelda.quimby@example.com")
      create(:work_order, organization: org, asset: asset, requester: requester, assignee: requester)

      described_class.call(organization: org, title: "Leak", asset: create(:asset, organization: org))
      text = sent.first[:messages].first[:content]

      expect(text).to include("by priority: none").and include("by severity: none")
      expect(text).not_to match(/Zelda|quimby/i)
    end

    it "sends a long title only up to a limit" do
      described_class.call(organization: org, title: "x" * 5_000)

      expect(sent.first[:messages].first[:content].length).to be < 2_000
    end

    it "sends a long description only up to a limit" do
      described_class.call(organization: org, title: "t", description: "x" * 5_000)

      expect(sent.first[:messages].first[:content].length).to be < 2_000
    end
  end
end
