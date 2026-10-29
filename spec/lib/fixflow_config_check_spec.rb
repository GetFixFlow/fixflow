require "rails_helper"
require "open3"

RSpec.describe FixflowConfigCheck do
  let(:good) do
    {
      "SECRET_KEY_BASE" => SecureRandom.hex(64), "DEVISE_JWT_SECRET_KEY" => SecureRandom.base64(64),
      "DATABASE_URL" => "postgres://fixflow:S3cure-pass@db:5432/fixflow_production",
      "REDIS_URL" => "redis://:S3cure-pass@redis:6379/0",
      "APP_URL" => "https://cmms.acme.test", "ALLOWED_ORIGINS" => "https://cmms.acme.test"
    }
  end

  def problems(overrides = {}) = described_class.new(good.merge(overrides)).problems

  def about(setting, overrides = {}) = problems(overrides).select { |problem| problem.setting == setting }

  # The problems about `setting` when it is given `value` (and anything else in `extra`).
  def given(setting, value, extra = {}) = about(setting, { setting => value }.merge(extra))

  it "finds nothing wrong with good settings" do
    expect(problems).to eq([])
  end

  describe "secrets" do
    it "stops the start when one is missing, and says how to make one" do
      found = about("DEVISE_JWT_SECRET_KEY", "DEVISE_JWT_SECRET_KEY" => "")
      expect(found.map(&:level)).to eq([:error])
      expect(found.first.message).to include("is not set", "openssl rand -base64 64")
      expect(about("SECRET_KEY_BASE", "SECRET_KEY_BASE" => nil).first.message).to include("bin/rails secret")
    end

    it "refuses the example values from .env.example" do
      found = about("SECRET_KEY_BASE", "SECRET_KEY_BASE" => "change_me_strong_password" * 4)
      expect(found.first).to have_attributes(level: :error, message: include("still the example value"))
    end

    it "refuses ones that are too short to be safe" do
      found = about("DEVISE_JWT_SECRET_KEY", "DEVISE_JWT_SECRET_KEY" => "s3cret-but-short")
      expect(found.first.message).to include("too short (16 characters; at least 32 are needed)")
      expect(about("SECRET_KEY_BASE", "SECRET_KEY_BASE" => "a" * 63)).not_to be_empty
      expect(about("SECRET_KEY_BASE", "SECRET_KEY_BASE" => "a" * 64)).to be_empty
    end
  end

  describe "the database and Redis addresses" do
    it "refuses an address that is not PostgreSQL's, or has no database name" do
      ["mysql://u:p@db/x", "not a url", "postgres://u:p@db", "postgres:///fixflow"].each do |url|
        expect(about("DATABASE_URL", "DATABASE_URL" => url).map(&:level)).to eq([:error]), url
      end
    end

    it "refuses the example password, even when it is encoded in the address" do
      plain = given("DATABASE_URL", "postgres://fixflow:password@db:5432/fixflow")
      encoded = given("DATABASE_URL", "postgres://fixflow:change%5Fme%5Fstrong@db/fixflow")
      redis = given("REDIS_URL", "redis://:change_me_strong_password@redis:6379/0")
      expect(plain.first).to have_attributes(level: :error, message: include("example password"))
      expect(encoded.map(&:level)).to eq([:error])
      expect(redis.map(&:level)).to eq([:error])
    end

    it "refuses a Redis address that is not Redis's" do
      expect(about("REDIS_URL", "REDIS_URL" => "http://redis:6379").first.message).to include("not a Redis address")
      expect(about("REDIS_URL", "REDIS_URL" => "rediss://:S3cure-pass@redis:6380/1")).to be_empty
    end

    it "only warns when they are not set (the server then uses this machine's)" do
      expect(about("DATABASE_URL", "DATABASE_URL" => "").map(&:level)).to eq([:warning])
      expect(about("REDIS_URL", "REDIS_URL" => nil).map(&:level)).to eq([:warning])
    end
  end

  describe "where people open FixFlow" do
    it "refuses an address that is not a web address or has a path" do
      ["cmms.acme.test", "ftp://cmms.acme.test", "https://cmms.acme.test/app"].each do |url|
        expect(about("APP_URL", "APP_URL" => url, "ALLOWED_ORIGINS" => nil).map(&:level)).to eq([:error]), url
      end
      expect(about("APP_URL", "APP_URL" => "https://cmms.acme.test/")).to be_empty
    end

    it "warns about the example address and about none at all, unless APP_HOST gives it" do
      expect(given("APP_URL", "https://app.fixflow.dev").first).to have_attributes(level: :warning, message: include("example address"))
      expect(about("APP_URL", "APP_URL" => nil).first.message).to include("point at https://localhost")
      expect(about("APP_URL", "APP_URL" => nil, "APP_HOST" => "cmms.acme.test")).to be_empty
    end

    it "refuses origins that are not origins, and warns when the web app's own address is missing from them" do
      bad = about("ALLOWED_ORIGINS", "ALLOWED_ORIGINS" => "https://cmms.acme.test, cmms.other.test, https://x.test/api").first
      expect(bad).to have_attributes(level: :error, message: include('"cmms.other.test"', '"https://x.test/api"'))
      expect(bad.message).not_to include('"https://cmms.acme.test"')
      missing = about("ALLOWED_ORIGINS", "ALLOWED_ORIGINS" => "http://localhost:5173").first
      expect(missing).to have_attributes(level: :warning, message: include("does not include APP_URL"))
      expect(about("ALLOWED_ORIGINS", "ALLOWED_ORIGINS" => "https://cmms.acme.test/")).to be_empty
      on_port = given("ALLOWED_ORIGINS", "https://cmms.acme.test:8443", "APP_URL" => "https://cmms.acme.test:8443")
      expect(on_port).to be_empty
    end
  end

  describe "mail, storage, IoT and the rest" do
    it "refuses a mail port that is not a port, and warns about the example mail password" do
      expect(about("SMTP_PORT", "SMTP_HOST" => "smtp.acme.test", "SMTP_PORT" => "99999").map(&:level)).to eq([:error])
      expect(about("SMTP_PORT", "SMTP_HOST" => "smtp.acme.test", "SMTP_PORT" => "abc")).not_to be_empty
      example = about("SMTP_PASSWORD", "SMTP_HOST" => "smtp.sendgrid.net", "SMTP_PASSWORD" => "your_sendgrid_api_key").first
      expect(example).to have_attributes(level: :warning, message: include("Settings, Email"))
      expect(problems("SMTP_PASSWORD" => "SG.real-key")).to eq([])
      expect(problems("SMTP_HOST" => "smtp.acme.test", "SMTP_PASSWORD" => "SG.real-key", "SMTP_PORT" => "2525")).to eq([])
    end

    it "warns about example storage and broker passwords and refuses a bad storage address" do
      expect(about("MINIO_SECRET_KEY", "MINIO_SECRET_KEY" => "change_me_strong_password").first.level).to eq(:warning)
      expect(about("MINIO_SECRET_KEY", "MINIO_SECRET_ACCESS_KEY" => "a-real-secret", "MINIO_SECRET_KEY" => "change_me")).to be_empty
      expect(about("MINIO_ENDPOINT", "MINIO_ENDPOINT" => "minio:9000").map(&:level)).to eq([:error])
      expect(about("BACKUP_S3_SECRET_KEY", "BACKUP_S3_ACCESS_KEY" => "key").first.level).to eq(:error)
      only_endpoint = { "BACKUP_S3_ENDPOINT" => "https://s3.example.com", "BACKUP_S3_SECRET_KEY" => "s" }
      expect(about("BACKUP_S3_ACCESS_KEY", only_endpoint).first.level).to eq(:error)
      bad_endpoint = { "BACKUP_S3_ACCESS_KEY" => "k", "BACKUP_S3_SECRET_KEY" => "s", "BACKUP_S3_ENDPOINT" => "s3.example.com" }
      expect(about("BACKUP_S3_ENDPOINT", bad_endpoint).map(&:level)).to eq([:error])
      expect(about("BACKUP_S3_ACCESS_KEY", "BACKUP_S3_ACCESS_KEY" => "k", "BACKUP_S3_SECRET_KEY" => "s")).to be_empty
      expect(about("MQTT_PASSWORD", "MQTT_HOST" => "mqtt", "MQTT_PASSWORD" => "change_me_strong_password").first.level).to eq(:warning)
      expect(about("MQTT_PORT", "MQTT_HOST" => "mqtt", "MQTT_PORT" => "0").first.level).to eq(:error)
    end

    it "warns when the update check is switched with a word that does not switch it off" do
      warned = about("FIXFLOW_UPDATE_CHECK", "FIXFLOW_UPDATE_CHECK" => "off").first
      expect(warned).to have_attributes(level: :warning, message: include("only `false` turns the update check off"))
      expect(about("FIXFLOW_UPDATE_CHECK", "FIXFLOW_UPDATE_CHECK" => "0")).not_to be_empty
      expect(about("FIXFLOW_UPDATE_CHECK", "FIXFLOW_UPDATE_CHECK" => "false")).to be_empty
      expect(about("FIXFLOW_UPDATE_CHECK", "FIXFLOW_UPDATE_CHECK" => "TRUE")).to be_empty
      expect(about("FIXFLOW_UPDATE_CHECK", "FIXFLOW_UPDATE_CHECK" => "")).to be_empty
    end

    it "warns about demo data and a missing AI key, and refuses a retention that is not a number of days" do
      expect(about("SEED_DB", "SEED_DB" => "true").first).to have_attributes(level: :warning, message: include("well-known password"))
      expect(about("SEED_DB", "SEED_DB" => "false")).to be_empty
      expect(about("ANTHROPIC_API_KEY", "AI_ENABLED" => "true", "ANTHROPIC_API_KEY" => "your_key_here").first.level).to eq(:warning)
      expect(about("ANTHROPIC_API_KEY", "AI_ENABLED" => "false", "ANTHROPIC_API_KEY" => "your_key_here")).to be_empty
      expect(about("IOT_RETENTION_DAYS", "IOT_RETENTION_DAYS" => "ninety").first.level).to eq(:error)
      expect(about("IOT_RETENTION_DAYS", "IOT_RETENTION_DAYS" => "90")).to be_empty
    end
  end

  describe ".report" do
    it "lists errors before warnings, names each setting, and says the server was not started" do
      list = described_class.new(good.merge("SEED_DB" => "true", "SECRET_KEY_BASE" => "")).problems
      text = described_class.report(list)
      expect(text.index("ERROR   SECRET_KEY_BASE")).to be < text.index("warning SEED_DB")
      expect(text).to include("FixFlow settings need attention:", "The server was not started")
    end

    it "does not claim the server stopped when there are only warnings, and is empty with none" do
      text = described_class.report(described_class.new(good.merge("SEED_DB" => "true")).problems)
      expect(text).to include("warning SEED_DB")
      expect(text).not_to include("not started")
      expect(described_class.report([])).to eq("")
    end
  end

  describe "the rake task" do
    def run_task(env)
      clean = { "RAILS_ENV" => "test", "DATABASE_URL" => ENV.fetch("DATABASE_URL", nil) }.compact
      Open3.capture2e(clean.merge(env), "bin/rails", "fixflow:check_config[static]", chdir: Rails.root.to_s, unsetenv_others: false)
    end

    it "exits with an error and a plain message when a secret is missing" do
      output, status = run_task(good.merge("SECRET_KEY_BASE" => ""))
      expect(status.exitstatus).to eq(1)
      expect(output).to include("ERROR   SECRET_KEY_BASE: is not set", "The server was not started")
    end

    it "exits cleanly, and quietly, with good settings" do
      output, status = run_task(good)
      expect(status.exitstatus).to eq(0)
      expect(output).not_to include("ERROR", "need attention")
    end

    it "prints warnings but still exits cleanly when only warnings are found" do
      output, status = run_task(good.merge("SEED_DB" => "true"))
      expect(status.exitstatus).to eq(0)
      expect(output).to include("warning SEED_DB")
    end
  end

  describe "the HTTPS front door" do
    let(:https) do
      { "COMPOSE_PROFILES" => "https", "HTTPS_DOMAIN" => "cmms.acme.test", "HTTPS_MODE" => "automatic",
        "APP_URL" => "https://cmms.acme.test", "HTTP_PORT" => "8080", "HTTP_BIND" => "127.0.0.1" }
    end

    def with_https(setting, value) = about(setting, https.merge(setting => value))

    it "is silent when it is not used, even with a company proxy and an https address" do
      expect(problems("APP_URL" => "https://cmms.acme.test", "HTTP_PORT" => "80")).to eq([])
    end

    it "finds nothing wrong with a complete setup, in each mode, and a port in APP_URL" do
      expect(problems(https)).to eq([])
      %w[automatic own-certificate internal].each { |mode| expect(problems(https.merge("HTTPS_MODE" => mode))).to eq([]) }
      local = https.merge("HTTPS_DOMAIN" => "localhost", "APP_URL" => "https://localhost:8443", "ALLOWED_ORIGINS" => "https://localhost:8443")
      expect(problems(local)).to eq([])
    end

    it "needs the domain when the profile is on, and refuses anything but a bare name" do
      expect(with_https("HTTPS_DOMAIN", "").map(&:level)).to eq([:error])
      ["https://cmms.acme.test", "cmms.acme.test:443", "cmms.acme.test/", "cmms acme", "-x.test"].each do |bad|
        expect(with_https("HTTPS_DOMAIN", bad).map(&:level)).to include(:error), bad
      end
    end

    it "warns when the domain is set but the profile is not on, so nothing would start" do
      found = about("HTTPS_DOMAIN", https.except("COMPOSE_PROFILES"))
      expect(found.map(&:level)).to eq([:warning])
      expect(found.first.message).to include("COMPOSE_PROFILES=https")
    end

    it "refuses an unknown mode, and an empty one means the default" do
      expect(with_https("HTTPS_MODE", "letsencrypt").first.message).to include("automatic, own-certificate, internal")
      expect(with_https("HTTPS_MODE", "")).to eq([])
    end

    it "refuses an APP_URL that is not the https address of the domain" do
      expect(with_https("APP_URL", "http://cmms.acme.test").first.message).to include("must be https://cmms.acme.test")
      expect(with_https("APP_URL", "https://other.acme.test").map(&:level)).to eq([:error])
      expect(with_https("APP_URL", "https://CMMS.acme.test")).to eq([])
    end

    it "refuses ports 80 and 443 for the plain-HTTP door, which the HTTPS one takes" do
      ["", "80", "443"].each { |port| expect(with_https("HTTP_PORT", port).map(&:level)).to eq([:error]), port.inspect }
    end

    it "warns when the plain-HTTP door is not closed to the network" do
      ["", "0.0.0.0", "192.168.1.5"].each { |bind| expect(with_https("HTTP_BIND", bind).map(&:level)).to eq([:warning]), bind.inspect }
      expect(with_https("HTTP_BIND", "localhost")).to eq([])
    end
  end

  describe "starting a production server" do
    # `rails server` in production with no secrets must stop at once with the plain message (not the bare
    # "key not found" a later initializer would raise). Only the failing case is started: with good settings
    # it would start serving.
    it "refuses to start, and says why" do
      env = { "HOME" => ENV.fetch("HOME", "/"), "PATH" => ENV.fetch("PATH"), "RAILS_ENV" => "production" }
      output, status = Open3.capture2e(env, "bin/rails", "server", "-p", "3999", chdir: Rails.root.to_s, unsetenv_others: true)
      expect(status.exitstatus).to eq(1)
      expect(output).to include("FixFlow settings need attention:", "ERROR   SECRET_KEY_BASE: is not set")
      expect(output).not_to include("KeyError")
    end
  end
end
