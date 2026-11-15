require "rails_helper"

RSpec.describe AiConfig do
  let(:org) { create(:organization) }

  before { allow(Resolv).to receive(:getaddresses) { |host| host == "model.lan" ? ["192.168.1.20"] : ["203.0.113.10"] } }

  def config = org.reload.ai_config

  def pick(changes) = config.assign(changes).tap { |c| c.save_to(org) }

  it "is off until an administrator picks a provider" do
    expect(config.provider).to eq("none")
    expect(config).not_to be_active
    expect(config.source).to be_nil
  end

  describe "saving" do
    it "keeps what was chosen, with the key encrypted" do
      pick(provider: "anthropic", model: "claude-opus-5-5", api_key: "sk-ant-SECRET")

      expect(config).to be_active
      expect(config.model).to eq("claude-opus-5-5")
      expect(config.api_key).to eq("sk-ant-SECRET")
      expect(config.source).to eq("app")
      expect(org.ai_settings.to_json).not_to include("sk-ant-SECRET")
    end

    it "uses a default model for Claude when none is given" do
      pick(provider: "anthropic", api_key: "sk-ant-x")

      expect(config.model).to eq("claude-sonnet-5-5")
    end

    it "keeps the saved key when the form leaves it blank" do
      pick(provider: "anthropic", api_key: "sk-ant-SECRET")
      pick(provider: "anthropic", model: "claude-opus-5-5", api_key: "")

      expect(config.api_key).to eq("sk-ant-SECRET")
    end

    it "does not keep a key that cannot be read any more (the app's secret changed)" do
      pick(provider: "anthropic", api_key: "sk-ant-SECRET")
      saved = org.ai_settings.deep_dup
      saved["providers"]["anthropic"]["key_ciphertext"] = "garbage"
      org.update!(ai_settings: saved)

      expect(config.api_key).to be_nil
      expect(config).not_to be_active
    end

    it "gives each provider its own settings, so a key is never sent to another provider" do
      pick(provider: "anthropic", api_key: "sk-ant-SECRET")
      pick(provider: "openai_compatible", base_url: "https://api.example.com/v1", model: "gpt-x", api_key: "sk-oa-OTHER")
      pick(provider: "local", base_url: "http://model.lan:11434/v1", model: "llama3")

      expect(config.setting("anthropic").api_key).to eq("sk-ant-SECRET")
      expect(config.setting("openai_compatible").api_key).to eq("sk-oa-OTHER")
      expect(config.setting("local").api_key).to be_nil
      expect(config.api_key).to be_nil # local is the one chosen: it has no key, and the others' are not borrowed
    end

    it "switching AI off keeps the settings, and switching back on needs nothing re-entered" do
      pick(provider: "anthropic", api_key: "sk-ant-SECRET")
      pick(provider: "none")

      expect(config).not_to be_active
      expect(config.setting("anthropic").api_key).to eq("sk-ant-SECRET")
      pick(provider: "anthropic")
      expect(config).to be_active
    end

    it "drops the saved key when the address changes to another host, since the key was given for the old one" do
      pick(provider: "openai_compatible", base_url: "https://api.example.com/v1", model: "m", api_key: "sk-oa-OLD")
      changed = config.assign(provider: "openai_compatible", base_url: "https://other.example.org/v1")

      expect(changed.setting("openai_compatible").api_key).to be_nil
      expect(changed).not_to be_valid
      expect(changed.errors.full_messages).to include("Key is missing")
    end

    it "keeps the saved key when only the path of the same host changes, and uses a new key when one comes with the new host" do
      pick(provider: "openai_compatible", base_url: "https://api.example.com/v1", model: "m", api_key: "sk-oa-OLD")

      expect(config.assign(provider: "openai_compatible", base_url: "https://api.example.com/openai/v1").api_key).to eq("sk-oa-OLD")
      expect(config.assign(provider: "openai_compatible", base_url: "https://other.example.org/v1", api_key: "sk-oa-NEW").api_key)
        .to eq("sk-oa-NEW")
    end

    it "ignores fields the chosen provider does not have" do
      pick(provider: "anthropic", api_key: "sk-ant-x", base_url: "https://evil.example.com/v1")

      expect(config.setting("anthropic").base_url).to be_nil
      expect(org.ai_settings.to_json).not_to include("evil.example.com")
    end

    it "ignores an unknown provider's fields and reports it" do
      changed = config.assign(provider: "skynet", model: "x", api_key: "k")

      expect(changed).not_to be_valid
      expect(changed.errors.full_messages.first).to include("Provider must be one of")
    end
  end

  describe "asking whether it is on" do
    it "does not look any name up, since it is asked on every page" do
      pick(provider: "local", base_url: "http://model.lan:11434/v1", model: "llama3")
      expect(Resolv).not_to receive(:getaddresses)

      expect(config).to be_active
    end

    it "still looks names up when saving" do
      looked_up = []
      allow(Resolv).to receive(:getaddresses) do |host|
        looked_up << host
        ["192.168.1.20"]
      end

      expect(config.assign(provider: "local", base_url: "http://model.lan:11434/v1", model: "llama3")).to be_valid
      expect(looked_up).to eq(["model.lan"])
    end

    it "is off for a numeric address that may not be used, and valid? stays strict afterwards" do
      changed = config.assign(provider: "local", base_url: "http://203.0.113.10/v1", model: "llama3")

      expect(changed).not_to be_active
      expect(changed).not_to be_valid
    end
  end

  describe "validation" do
    it "needs a key for Claude and for an OpenAI-compatible service, but not for a local model" do
      expect(config.assign(provider: "anthropic")).not_to be_valid
      expect(config.assign(provider: "openai_compatible", base_url: "https://api.example.com/v1", model: "m")).not_to be_valid
      expect(config.assign(provider: "local", base_url: "http://model.lan:11434/v1", model: "llama3")).to be_valid
    end

    it "needs a model for the services that have no default" do
      changed = config.assign(provider: "local", base_url: "http://model.lan:11434/v1")

      expect(changed).not_to be_valid
      expect(changed.errors.full_messages).to include("Model is missing")
    end

    it "checks the address against the kind of provider" do
      wrong = config.assign(provider: "local", base_url: "http://api.example.com/v1", model: "m")

      expect(wrong).not_to be_valid
      expect(wrong.errors.full_messages.first).to start_with("Address")
      expect(config.assign(provider: "openai_compatible", base_url: "http://model.lan/v1", model: "m", api_key: "k")).not_to be_valid
    end

    it "limits how long a model name and a key can be" do
      expect(config.assign(provider: "anthropic", model: "m" * 201, api_key: "k")).not_to be_valid
      expect(config.assign(provider: "anthropic", api_key: "k" * 1001)).not_to be_valid
    end

    it "is valid when AI is off, whatever else is in the form" do
      expect(config.assign(provider: "none", model: "", base_url: "junk")).to be_valid
    end
  end

  describe "the features" do
    it "are all on once AI is on, and off while it is off" do
      expect(config.feature?(:priority)).to be(false)
      pick(provider: "anthropic", api_key: "sk-ant-x")

      expect(config.features).to eq("priority" => true, "anomalies" => true)
      expect(config.feature?(:priority)).to be(true)
      expect(config.feature?("anomalies")).to be(true)
      pick(provider: "none")
      expect(config.feature?(:anomalies)).to be(false)
    end

    it "start on for a configuration made without any saved switches" do
      expect(described_class.new(provider: "anthropic").features).to eq("priority" => true, "anomalies" => true)
    end

    it "can be switched off one at a time, and the switch survives a change of provider" do
      pick(provider: "anthropic", api_key: "sk-ant-x")
      pick(features: { priority: false })

      expect(config.feature?(:priority)).to be(false)
      expect(config.feature?(:anomalies)).to be(true)
      pick(provider: "anthropic", model: "claude-opus-5-5")
      expect(config.feature?(:priority)).to be(false)
      expect(config.api_key).to eq("sk-ant-x")
    end

    it "understand the words a form sends, and ignore a feature that does not exist" do
      pick(provider: "anthropic", api_key: "sk-ant-x")
      pick(features: { priority: "false", anomalies: "true", telepathy: false })

      expect(config.features).to eq("priority" => false, "anomalies" => true)
    end

    it "can be saved on their own, so a server set up through its environment keeps using it" do
      env = { "AI_ENABLED" => "true", "ANTHROPIC_API_KEY" => "sk-ant-ENV" }

      pick(features: { anomalies: false })

      expect(org.ai_settings).to eq("features" => { "priority" => true, "anomalies" => false })
      expect(config.source).to be_nil
      effective = described_class.effective(org, env: env)
      expect(effective).to have_attributes(provider: "anthropic", source: "environment")
      expect(effective.feature?(:priority)).to be(true)
      expect(effective.feature?(:anomalies)).to be(false)
    end

    it "do not save a provider that was never chosen" do
      pick(features: { priority: false })

      expect(org.ai_settings).not_to have_key("provider")
    end
  end

  describe "where the data goes" do
    it "names the host, never anything secret" do
      pick(provider: "openai_compatible", base_url: "https://api.example.com/v1", model: "m", api_key: "sk-oa-SECRET")

      expect(config.where).to eq("api.example.com")
      pick(provider: "anthropic")
      expect(config.where).to eq("api.anthropic.com")
      pick(provider: "none")
      expect(config.where).to be_nil
    end

    it "knows a local model" do
      pick(provider: "local", base_url: "http://model.lan:11434/v1", model: "llama3")

      expect(config).to be_local
    end
  end

  describe ".effective (the server's environment)" do
    let(:env) { { "AI_ENABLED" => "true", "ANTHROPIC_API_KEY" => "sk-ant-ENV", "AI_MODEL" => "claude-haiku-5-5" } }

    it "is off when nothing is saved and the environment does not switch it on" do
      expect(described_class.effective(org, env: {})).not_to be_active
      expect(described_class.effective(org, env: env.merge("AI_ENABLED" => "false"))).not_to be_active
      expect(described_class.effective(org, env: env.merge("ANTHROPIC_API_KEY" => ""))).not_to be_active
    end

    it "runs Claude from the environment for an install set up that way, as before" do
      config = described_class.effective(org, env: env)

      expect(config).to be_active
      expect(config).to have_attributes(provider: "anthropic", source: "environment", model: "claude-haiku-5-5", api_key: "sk-ant-ENV")
    end

    it "uses the default model when the environment names none" do
      expect(described_class.effective(org, env: env.except("AI_MODEL")).model).to eq("claude-sonnet-5-5")
    end

    it "gives way to what was saved on the screen, and to a saved choice of 'off'" do
      pick(provider: "none")

      expect(described_class.effective(org.reload, env: env)).not_to be_active
      pick(provider: "local", base_url: "http://model.lan:11434/v1", model: "llama3")
      expect(described_class.effective(org.reload, env: env)).to have_attributes(provider: "local", source: "app")
    end

    it "works with no company at all" do
      expect(described_class.effective(nil, env: env)).to be_active
      expect(described_class.effective(nil, env: {})).not_to be_active
    end
  end
end
