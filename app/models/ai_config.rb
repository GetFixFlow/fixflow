# Which AI provider a company uses, and how it is set up. AI is off until an administrator picks one. Kept on the organization;
# the keys are encrypted (AiSecret).
#
# Each provider keeps its own settings, so switching from one to another never sends the first one's key to the second.
# A key is also dropped when the address it belongs to changes, unless a new key comes with it.
#
#   none               AI is off (the default)
#   anthropic          Claude, on Anthropic's service. Needs a key.
#   openai_compatible  a service on the internet that speaks the OpenAI chat API (OpenAI, OpenRouter, Groq...). Needs an address
#                      and usually a key.
#   local              a model the company runs on its own network (Ollama, LM Studio, vLLM, llama.cpp...). The address must be on
#                      this server or a private network (see AiAddress), so with it no data leaves the company.
#
# What the AI does is switched on and off per feature (FEATURES), all on once AI is. They are kept apart from the provider, so
# switching a feature off keeps the provider's settings, and an install that is set up through its environment can switch a
# feature off without saving a provider.
#
# An install that has saved nothing here still works from the server's environment (AI_ENABLED, ANTHROPIC_API_KEY, AI_MODEL),
# as it did before the provider could be chosen on the screen. Anything saved here wins over it, "none" included.
class AiConfig
  include ActiveModel::Validations

  PROVIDERS = %w[none anthropic openai_compatible local].freeze
  # The providers that are chosen from, with the fields each one asks for.
  FIELDS = {
    "anthropic" => %w[model api_key],
    "openai_compatible" => %w[base_url model api_key],
    "local" => %w[base_url model api_key]
  }.freeze
  KEY_REQUIRED = %w[anthropic openai_compatible].freeze
  DEFAULT_MODELS = { "anthropic" => "claude-sonnet-5-5" }.freeze
  # priority: suggests a priority for a new work order (asks the provider). anomalies: flags unusual sensor readings (arithmetic
  # on the server; nothing is sent to the provider).
  FEATURES = %w[priority anomalies].freeze

  Setting = Struct.new(:model, :base_url, :api_key, keyword_init: true) do
    def key_set? = api_key.present?
  end

  # The words for a field in an error message.
  LABELS = { "base_url" => "Address", "api_key" => "Key", "model" => "Model", "provider" => "Provider" }.freeze

  attr_reader :provider, :source, :features

  validates :provider, inclusion: { in: PROVIDERS, message: "must be one of #{PROVIDERS.join(', ')}" }
  validate :selected_is_complete

  def self.human_attribute_name(attribute, _options = {}) = LABELS.fetch(attribute.to_s) { attribute.to_s.humanize }

  def self.load(organization)
    saved = (organization&.ai_settings || {}).with_indifferent_access
    provider = PROVIDERS.include?(saved[:provider]) ? saved[:provider] : "none"
    config = new(provider: provider, source: saved.key?(:provider) ? "app" : nil)
    config.features = saved[:features]
    FIELDS.each_key do |kind|
      one = (saved.dig(:providers, kind) || {}).with_indifferent_access
      config.setting(kind).model = one[:model]
      config.setting(kind).base_url = one[:base_url]
      config.setting(kind).api_key = AiSecret.decrypt(one[:key_ciphertext])
    end
    config
  end

  # What a company's AI really runs on: what was saved, or else the server's environment (the way it was set up before the
  # provider could be chosen on the screen), or else off.
  def self.effective(organization, env: ENV)
    saved = load(organization)
    return saved if saved.source == "app"

    key = env["ANTHROPIC_API_KEY"].to_s
    return saved unless ActiveModel::Type::Boolean.new.cast(env["AI_ENABLED"]) && key.present?

    from_environment(key, env["AI_MODEL"].presence, saved.features)
  end

  def self.from_environment(key, model, features = nil)
    new(provider: "anthropic", source: "environment").tap do |config|
      config.features = features
      config.setting("anthropic").api_key = key
      config.setting("anthropic").model = model
    end
  end

  def initialize(provider: "none", source: nil)
    @provider = provider
    @source = source
    @provider_saved = source == "app"
    @features = FEATURES.index_with(true)
    @settings = FIELDS.keys.index_with { Setting.new }
  end

  def setting(kind) = @settings.fetch(kind)

  # The setting of the provider that is chosen (an empty one when AI is off).
  def selected = @provider == "none" ? Setting.new : setting(@provider)

  # On and complete. A name in the address is not looked up here (this is asked on every page); saving looked it up, and every
  # call looks it up again before it connects.
  def active?
    return false if @provider == "none"

    @resolve_names = false
    valid?
  ensure
    @resolve_names = true
  end

  def local? = @provider == "local"

  # On, and this feature has not been switched off.
  def feature?(name) = @features.fetch(name.to_s, false) && active?

  # A feature the person switched off stays off; one that was never mentioned is on.
  def features=(saved)
    saved = (saved || {}).to_h.with_indifferent_access
    @features = FEATURES.index_with { |name| !saved.key?(name) || ActiveModel::Type::Boolean.new.cast(saved[name]) != false }
  end

  def model = selected.model.presence || DEFAULT_MODELS[@provider]
  delegate :api_key, :base_url, to: :selected

  # Change from form input: the provider chosen, and that provider's own fields. A blank key means "keep the one already saved",
  # unless the address changed, since a key belongs to the address it was given for.
  def assign(changes)
    changes = changes.to_h.with_indifferent_access
    self.features = @features.merge(changes[:features].to_h.slice(*FEATURES)) if changes[:features].present?
    if changes.key?(:provider)
      @provider = changes[:provider].to_s
      @provider_saved = true
    end
    return self if PROVIDERS.exclude?(@provider) || @provider == "none"

    one = setting(@provider)
    one.model = changes[:model].to_s.strip if changes.key?(:model)
    assign_address(one, changes[:base_url].to_s.strip) if changes.key?(:base_url) && FIELDS[@provider].include?("base_url")
    one.api_key = changes[:api_key].to_s.strip if changes[:api_key].present?
    self
  end

  def save_to(organization)
    organization.update!(ai_settings: stored_form)
  end

  # Where the model answers, in words that do not give a secret away: the host of the address, or the provider's own name.
  def where
    case @provider
    when "anthropic" then "api.anthropic.com"
    when "openai_compatible", "local" then host_of(selected.base_url)
    end
  end

  def host_of(url)
    URI.parse(url).host if url.present?
  rescue URI::InvalidURIError
    nil
  end

  private

  def assign_address(one, address)
    one.api_key = nil if host_of(address) != host_of(one.base_url)
    one.base_url = address
  end

  def selected_is_complete
    return if PROVIDERS.exclude?(@provider) || @provider == "none"

    one = setting(@provider)
    errors.add(:model, "is missing") if model.blank?
    errors.add(:model, "is too long") if model.to_s.length > 200
    errors.add(:api_key, "is missing") if KEY_REQUIRED.include?(@provider) && !one.key_set?
    errors.add(:api_key, "is too long") if one.api_key.to_s.length > 1000
    return unless FIELDS[@provider].include?("base_url")

    problem = AiAddress.problem(@provider, one.base_url, resolve: @resolve_names != false)
    errors.add(:base_url, problem) if problem
  end

  def stored_form
    providers = FIELDS.each_key.with_object({}) do |kind, all|
      one = setting(kind)
      next if one.model.blank? && one.base_url.blank? && !one.key_set?

      all[kind] = { "model" => one.model, "base_url" => one.base_url, "key_ciphertext" => AiSecret.encrypt(one.api_key) }.compact
    end
    saved = { "features" => @features }
    saved.merge!("provider" => @provider, "providers" => providers) if @provider_saved
    saved
  end
end
