require "rails_helper"

RSpec.describe "Plugins", type: :request do
  let(:org)     { create(:organization) }
  let(:admin)   { create(:user, :admin, organization: org) }
  let(:address) { "https://hooks.example.test/in" }

  before do
    allow(Resolv).to receive(:getaddresses).and_return(["203.0.113.10"])
    install_plugins("demo" => PluginHelpers::GOOD_PLUGIN, "broken" => "raise 'boom'")
  end

  def api(verb, path, params: nil, as: admin) = send(verb, path, params: params, as: :json, headers: auth_headers_for(as))
  def plugin = json_body["plugin"] || json_body["plugins"].find { |entry| entry["key"] == "demo" }
  def echo = plugin["channels"].first

  describe "who may" do
    it "is for administrators only, in every way" do # rubocop:disable RSpec/ExampleLength
      [create(:user, :manager, organization: org), create(:user, organization: org),
       create(:user, :requester, organization: org)].each do |person|
        api(:get, "/api/v1/plugins", as: person)
        expect(response).to have_http_status(:forbidden)
        api(:patch, "/api/v1/plugins/demo", params: { plugin: { enabled: true } }, as: person)
        expect(response).to have_http_status(:forbidden)
        api(:put, "/api/v1/plugins/demo/channels/echo", params: { channel: { enabled: true } }, as: person)
        expect(response).to have_http_status(:forbidden)
        api(:delete, "/api/v1/plugins/demo/channels/echo", as: person)
        expect(response).to have_http_status(:forbidden)
        api(:post, "/api/v1/plugins/demo/channels/echo/test", params: { channel: { values: { address: address } } }, as: person)
        expect(response).to have_http_status(:forbidden)
      end
      expect(Plugins::Settings.for(org.reload).enabled?("demo")).to be(false)
    end

    it "needs a sign-in" do
      get "/api/v1/plugins"

      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "GET /api/v1/plugins" do
    it "lists what is installed, what failed to load and why, and the events a channel can hear" do
      api(:get, "/api/v1/plugins")

      expect(response).to have_http_status(:ok)
      expect(json_body).to include("api_version" => 1)
      expect(plugin).to include("title" => "Demo", "version" => "2.0.0", "enabled" => false, "folder" => "demo")
      expect(plugin["reports"]).to eq([{ "key" => "things", "title" => "Things", "description" => "All the things" }])
      expect(echo).to include("key" => "echo", "title" => "Echo", "enabled" => false)
      expect(echo["fields"].map { |field| field.slice("key", "kind", "required") })
        .to eq([{ "key" => "address", "kind" => "url", "required" => true },
                { "key" => "token", "kind" => "secret", "required" => false }])
      expect(json_body["failures"]).to eq([{ "folder" => "broken", "message" => "RuntimeError: boom" }])
      expect(json_body["available_events"].pluck("key")).to match_array(ChatConfig::EVENTS.keys)
    end
  end

  describe "PATCH /api/v1/plugins/:key" do
    it "switches a plugin on and off for the company, and the audit log says who" do
      api(:patch, "/api/v1/plugins/demo", params: { plugin: { enabled: true } })

      expect(response).to have_http_status(:ok)
      expect(json_body["plugin"]).to include("key" => "demo", "enabled" => true)
      expect(Plugins::Settings.for(org.reload).enabled?("demo")).to be(true)
      expect(ActivityLog.where(action: "plugin.enabled").last).to have_attributes(user_id: admin.id, metadata: { "plugin" => "demo" })

      api(:patch, "/api/v1/plugins/demo", params: { plugin: { enabled: false } })

      expect(json_body["plugin"]["enabled"]).to be(false)
      expect(ActivityLog.where(action: "plugin.disabled")).to exist
    end

    it "is for the administrator's own company only" do
      other = create(:organization)

      api(:patch, "/api/v1/plugins/demo", params: { plugin: { enabled: true } })

      expect(Plugins::Settings.for(other).enabled?("demo")).to be(false)
    end

    it "says not found for a plugin that is not installed, and refuses a name that could not be one" do
      api(:patch, "/api/v1/plugins/nothing", params: { plugin: { enabled: true } })
      expect(response).to have_http_status(:not_found)

      api(:patch, "/api/v1/plugins/..%2Fsecrets", params: { plugin: { enabled: true } })
      expect(response).to have_http_status(:not_found)
    end

    it "needs the plugin parameter" do
      api(:patch, "/api/v1/plugins/demo", params: {})

      expect(response).to have_http_status(:bad_request)
    end
  end

  describe "PUT /api/v1/plugins/:key/channels/:channel" do
    def save(**channel) = api(:put, "/api/v1/plugins/demo/channels/echo", params: { channel: channel })

    it "saves the channel, never sends a secret back, and writes an audit line" do
      save(enabled: true, events: %w[wo_assigned], values: { address: address, token: "tok-SECRET-123" })

      expect(response).to have_http_status(:ok)
      expect(echo).to include("enabled" => true, "events" => ["wo_assigned"], "values" => { "address" => address },
                              "secrets_set" => { "token" => true })
      expect(response.body).not_to include("tok-SECRET-123")
      expect(org.reload.plugin_settings.to_json).not_to include("tok-SECRET-123")
      expect(ActivityLog.where(action: "plugin.channel_updated").last.metadata).to include("plugin" => "demo", "channel" => "echo",
"enabled" => true)
      expect(ActivityLog.where(action: "plugin.channel_updated").last.metadata.to_json).not_to include("tok-SECRET-123")
    end

    it "keeps the saved secret when it is sent blank" do
      save(values: { token: "tok-1" })
      save(values: { token: "" })

      expect(Plugins::Settings.for(org.reload).channel("demo",
"echo").settings_for(Plugins.channel("demo", "echo"))[:token]).to eq("tok-1")
    end

    it "says what is wrong, in words, and saves nothing" do
      save(enabled: true, values: { address: "http://127.0.0.1:3000/x" })
      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body["error"]).to include("code" => "VALIDATION_ERROR",
"message" => "Address points at this server or a link-local address.")

      save(enabled: true, values: {})
      expect(json_body["error"]["message"]).to eq("Address is needed.")
      expect(org.reload.plugin_settings).to eq({})
    end

    it "says not found for a channel the plugin does not have" do
      api(:put, "/api/v1/plugins/demo/channels/nothing", params: { channel: { enabled: true } })

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "DELETE /api/v1/plugins/:key/channels/:channel" do
    it "forgets the channel's settings and its secrets" do
      api(:put, "/api/v1/plugins/demo/channels/echo",
params: { channel: { enabled: true, values: { address: address, token: "tok-1" } } })

      api(:delete, "/api/v1/plugins/demo/channels/echo")

      expect(response).to have_http_status(:ok)
      expect(echo).to include("enabled" => false, "values" => { "address" => "" }, "secrets_set" => { "token" => false })
      expect(ActivityLog.where(action: "plugin.channel_removed")).to exist
    end
  end

  describe "POST /api/v1/plugins/:key/channels/:channel/test" do
    def test_with(values) = api(:post, "/api/v1/plugins/demo/channels/echo/test", params: { channel: { values: values } })

    it "sends a test message through the channel with the values given, without saving them" do
      test_with(address: address, token: "tok-1")

      expect(response).to have_http_status(:ok)
      expect(json_body).to include("success" => true)
      message, settings = PluginHelpers.deliveries.first
      expect(message).to have_attributes(event: "test", title: "FixFlow is connected", company: org.name)
      expect(message.body).to include(admin.full_name)
      expect(settings).to include(address: address, token: "tok-1")
      expect(org.reload.plugin_settings).to eq({})
    end

    it "uses the saved secret when the form leaves it blank" do
      api(:put, "/api/v1/plugins/demo/channels/echo", params: { channel: { values: { token: "tok-saved" } } })

      test_with(address: address, token: "")

      expect(PluginHelpers.deliveries.first.last).to include(token: "tok-saved")
    end

    it "says what the channel said when it cannot deliver" do
      install_plugins("demo" => PluginHelpers::GOOD_PLUGIN.sub("PluginHelpers.deliveries << [message, settings]",
'raise Plugins::Refused, "The token was not accepted."'))

      test_with(address: address)

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body["error"]).to include("code" => "PLUGIN_TEST_FAILED", "message" => "The token was not accepted.")
    end

    it "refuses what the form would refuse, before anything is sent" do
      test_with(address: "http://127.0.0.1/x")

      expect(response).to have_http_status(:unprocessable_entity)
      expect(PluginHelpers.deliveries).to be_empty
    end
  end
end
