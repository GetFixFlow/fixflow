require "rails_helper"

RSpec.describe "Chat settings", type: :request do
  let(:org)     { create(:organization) }
  let(:admin)   { create(:user, :admin, organization: org) }
  let(:webhook) { "https://hooks.slack.com/services/T000/B000/SECRETPART" }

  before { allow(Resolv).to receive(:getaddresses).and_return(["203.0.113.10"]) }

  def save_chat(chat, as: admin) = patch("/api/v1/chat_settings", params: { chat: chat }, as: :json, headers: auth_headers_for(as))
  def chat = json_body["chat"]

  describe "who may" do
    it "is for administrators only, in every way" do
      [create(:user, :manager, organization: org), create(:user, organization: org),
       create(:user, :requester, organization: org)].each do |person|
        get "/api/v1/chat_settings", headers: auth_headers_for(person)
        expect(response).to have_http_status(:forbidden)
        save_chat({ enabled: false }, as: person)
        expect(response).to have_http_status(:forbidden)
        delete "/api/v1/chat_settings", headers: auth_headers_for(person)
        expect(response).to have_http_status(:forbidden)
        post "/api/v1/chat_settings/test", params: { chat: { url: webhook } }, as: :json, headers: auth_headers_for(person)
        expect(response).to have_http_status(:forbidden)
      end
    end

    it "needs a sign-in" do
      get "/api/v1/chat_settings"

      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "GET /api/v1/chat_settings" do
    it "starts empty, with every event on offer" do
      get "/api/v1/chat_settings", headers: auth_headers_for(admin)

      expect(response).to have_http_status(:ok)
      expect(chat).to include("enabled" => false, "url_set" => false, "url_hint" => nil, "kind" => "slack")
      expect(chat["available_events"].pluck("key")).to eq(ChatConfig::EVENTS.keys)
    end
  end

  describe "PATCH /api/v1/chat_settings" do
    it "saves the kind, the events and the address, and answers with the host of the address, never the address" do
      save_chat({ kind: "slack", enabled: true, url: webhook, events: %w[wo_assigned iot_alert] })

      expect(response).to have_http_status(:ok)
      expect(chat).to include("enabled" => true, "url_set" => true, "url_hint" => "hooks.slack.com",
"events" => %w[wo_assigned iot_alert])
      expect(response.body).not_to include("SECRETPART")
      get "/api/v1/chat_settings", headers: auth_headers_for(admin)
      expect(response.body).not_to include("SECRETPART")
    end

    it "keeps the address in the database encrypted" do
      save_chat({ enabled: true, url: webhook })

      expect(org.reload.chat_settings.to_json).not_to include("SECRETPART")
      expect(org.chat_config.url).to eq(webhook)
    end

    it "keeps the saved address when the form leaves it blank" do
      save_chat({ enabled: true, url: webhook })
      save_chat({ enabled: true, url: "", events: %w[part_low_stock] })

      expect(response).to have_http_status(:ok)
      expect(org.reload.chat_config).to have_attributes(url: webhook, events: %w[part_low_stock])
    end

    {
      "an address inside this server" => [{ enabled: true, url: "http://169.254.169.254/latest/meta-data" }, /never a chat service/],
      "an address that is not a web address" => [{ enabled: true, url: "ftp://example.com/x" }, %r{https://}],
      "switching it on with no address" => [{ enabled: true }, /needed to turn chat messages on/],
      "a kind that does not exist" => [{ kind: "irc", url: "https://hooks.example.com/x" }, /Kind/],
      "an event FixFlow does not post" => [{ events: %w[launch_missiles], url: "https://hooks.example.com/x" }, /launch_missiles/]
    }.each do |what, (body, message)|
      it "refuses #{what}, with the reason, and saves nothing" do
        save_chat(body)

        expect(response).to have_http_status(:unprocessable_content)
        expect(json_body.dig("error", "message")).to match(message)
        expect(org.reload.chat_settings).to eq({})
      end
    end

    it "writes it to the audit log without the address" do
      expect { save_chat({ enabled: true, url: webhook }) }.to change { ActivityLog.where(action: "chat_settings.updated").count }.by(1)

      expect(ActivityLog.where(action: "chat_settings.updated").last.to_json).not_to include("SECRETPART")
    end
  end

  describe "DELETE /api/v1/chat_settings" do
    it "stops posting and forgets the address" do
      save_chat({ enabled: true, url: webhook })

      delete "/api/v1/chat_settings", headers: auth_headers_for(admin)

      expect(response).to have_http_status(:ok)
      expect(chat).to include("enabled" => false, "url_set" => false)
      expect(org.reload.chat_settings).to eq({})
    end
  end

  describe "POST /api/v1/chat_settings/test" do
    it "posts a test message through the address given, without saving it" do
      sent = stub_request(:post, webhook).to_return(status: 200)

      post "/api/v1/chat_settings/test", params: { chat: { kind: "slack", url: webhook } }, as: :json, headers: auth_headers_for(admin)

      expect(response).to have_http_status(:ok)
      expect(json_body["message"]).to include("Test message sent")
      expect(sent).to have_been_requested.once
      expect(org.reload.chat_settings).to eq({})
    end

    it "uses the saved address when none is given" do
      save_chat({ enabled: true, url: webhook })
      sent = stub_request(:post, webhook).to_return(status: 200)

      post "/api/v1/chat_settings/test", headers: auth_headers_for(admin)

      expect(response).to have_http_status(:ok)
      expect(sent).to have_been_requested.once
    end

    it "says what the chat service said when it refuses, without giving the address back" do
      stub_request(:post, webhook).to_return(status: 404)

      post "/api/v1/chat_settings/test", params: { chat: { url: webhook } }, as: :json, headers: auth_headers_for(admin)

      expect(response).to have_http_status(:unprocessable_content)
      expect(json_body.dig("error", "message")).to match(/does not know that webhook/)
      expect(response.body).not_to include("SECRETPART")
    end

    it "says so when there is no address to test, and never posts to an unsafe one" do
      trap = stub_request(:any, /./)

      post "/api/v1/chat_settings/test", headers: auth_headers_for(admin)
      expect(response).to have_http_status(:unprocessable_content)

      post "/api/v1/chat_settings/test", params: { chat: { url: "http://169.254.169.254/x" } }, as: :json,
headers: auth_headers_for(admin)
      expect(response).to have_http_status(:unprocessable_content)
      expect(trap).not_to have_been_requested
    end
  end
end
