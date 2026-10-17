require "rails_helper"
require "sidekiq/api"

# The administrator's health page: what each check says in each situation.
RSpec.describe "GET /api/v1/system_health", type: :request do
  let(:org)     { create(:organization) }
  let(:admin)   { create(:user, :admin, organization: org) }
  let(:release) { "https://api.github.com/repos/GetFixFlow/fixflow/releases/latest" }

  def health(as: admin)
    get "/api/v1/system_health", headers: auth_headers_for(as)
    expect(response).to have_http_status(:ok)
    response.parsed_body
  end

  def with_env(extra) = stub_const("ENV", ENV.to_h.merge(extra))

  # Whether the mail server or broker at `address` can be reached; every other connection (Redis, say) is left alone.
  def server(address, working: true)
    allow(Socket).to receive(:tcp).and_call_original
    allow(Socket).to receive(:tcp).with(address, any_args) { raise Errno::ECONNREFUSED unless working }
  end

  def workers(count: 1, latency: 0, dead: 0, retrying: 0)
    allow(Sidekiq::ProcessSet).to receive(:new).and_return(instance_double(Sidekiq::ProcessSet, size: count, sum: 0))
    allow(Sidekiq::Stats).to receive(:new).and_return(
      instance_double(Sidekiq::Stats, enqueued: 2, scheduled_size: 1, retry_size: retrying, dead_size: dead)
    )
    allow(Sidekiq::Queue).to receive(:all).and_return([instance_double(Sidekiq::Queue, latency: latency)])
  end

  before do
    stub_request(:get, release).to_return(status: 404)
    workers
  end

  describe "who may ask" do
    it "is for administrators only" do
      [create(:user, :manager, organization: org), create(:user, organization: org),
       create(:user, :requester, organization: org)].each do |person|
        get "/api/v1/system_health", headers: auth_headers_for(person)
        expect(response).to have_http_status(:forbidden)
      end
    end

    it "needs a signed-in person" do
      get "/api/v1/system_health"
      expect(response).to have_http_status(:unauthorized)
    end

    it "is never stored by a browser or a proxy" do
      health
      expect(response.headers["Cache-Control"]).to include("no-store")
    end
  end

  describe "the app, database and Redis" do
    it "reports the version, the environment and how long the server has been up" do
      with_env("APP_VERSION" => "1.4.2")
      app = health["app"]
      expect(app).to include("version" => "1.4.2", "environment" => "test", "ruby" => RUBY_VERSION, "rails" => Rails.version)
      expect(app["uptime_seconds"]).to be_a(Integer).and be >= 0
    end

    it "reports a database that answers, with its server version and no migrations left to run" do
      database = health["database"]
      expect(database).to include("status" => "ok", "pending_migrations" => 0)
      expect(database["latency_ms"]).to be_a(Float)
      expect(database["server"]).to match(/\A\d+/)
    end

    it "warns about migrations that have not been run" do
      migrations = instance_double(ActiveRecord::MigrationContext, pending_migration_versions: [1, 2])
      allow_any_instance_of(ActiveRecord::ConnectionAdapters::ConnectionPool).to receive(:migration_context).and_return(migrations) # rubocop:disable RSpec/AnyInstance
      database = health["database"]
      expect(database).to include("status" => "warning", "pending_migrations" => 2)
      expect(database["message"]).to include("2 database migration(s)", "db:migrate")
    end

    it "reports Redis with its version" do
      expect(health["redis"]).to include("status" => "ok")
      expect(health["redis"]["server"]).to match(/\A\d+\./)
    end

    it "says plainly that Redis is down, and the page itself still answers" do
      allow_any_instance_of(SystemHealth).to receive(:redis_client).and_raise(Redis::CannotConnectError, "connection refused") # rubocop:disable RSpec/AnyInstance
      body = health
      expect(body["redis"]).to include("status" => "error", "latency_ms" => nil)
      expect(body["redis"]["message"]).to include("Redis did not answer", "connection refused")
      expect(body["status"]).to eq("error")
    end
  end

  describe "the background worker" do
    it "is ok with a worker running, and says how much is waiting" do
      workers(count: 2)
      expect(health["background_jobs"]).to include("status" => "ok", "workers" => 2, "queued" => 2, "scheduled" => 1, "dead" => 0)
    end

    it "is an error with no worker running, because emails, PM work orders and IoT alerts then silently stop" do
      workers(count: 0)
      jobs = health["background_jobs"]
      expect(jobs).to include("status" => "error", "workers" => 0)
      expect(jobs["message"]).to include("No background worker is running", "emails", "Start Sidekiq")
      expect(health["status"]).to eq("error")
    end

    it "warns when jobs have been waiting a long time, and when some failed for good" do
      workers(latency: 601)
      expect(health["background_jobs"]).to include("status" => "warning", "latency_seconds" => 601)
      expect(health["background_jobs"]["message"]).to include("waiting 11 minutes")
      workers(dead: 3)
      expect(health["background_jobs"]["message"]).to include("3 background job(s) failed for good")
    end

    it "does not worry about jobs that are merely being retried" do
      workers(retrying: 4)
      expect(health["background_jobs"]).to include("status" => "ok", "retrying" => 4)
    end
  end

  describe "email" do
    it "warns that nothing is set up, and what that means" do
      allow(EmailSetup).to receive(:source).and_return(nil)
      email = health["email"]
      expect(email).to include("status" => "warning", "source" => nil, "host" => nil)
      expect(email["message"]).to include("invitations, password resets", "Settings, Email")
    end

    it "is ok when the mail server in the environment answers" do
      with_env("SMTP_HOST" => "smtp.acme.test", "SMTP_PORT" => "2525")
      allow(EmailSetup).to receive(:source).and_return(:environment)
      server("smtp.acme.test")
      expect(health["email"]).to include("status" => "ok", "source" => "environment", "host" => "smtp.acme.test", "port" => 2525,
                                         "reachable" => true)
    end

    it "is an error when the saved mail server does not answer" do
      allow(EmailSetup).to receive_messages(source: :settings, saved_config: SmtpConfig.new(host: "mail.acme.test", port: 587))
      server("mail.acme.test", working: false)
      email = health["email"]
      expect(email).to include("status" => "error", "source" => "settings", "reachable" => false)
      expect(email["message"]).to include("mail.acme.test:587 did not answer")
    end
  end

  describe "IoT over MQTT" do
    it "is simply off when no broker is set up" do
      with_env("MQTT_HOST" => "")
      expect(health["mqtt"]).to include("status" => "off", "configured" => false, "broker" => nil)
    end

    it "notices a broker on this machine even when MQTT_HOST is not set, because the subscriber tries localhost" do
      with_env("MQTT_HOST" => "")
      allow(Iot::MqttStatus).to receive(:read).and_return({ connected: true, last_message_at: nil })
      expect(health["mqtt"]).to include("status" => "ok", "broker" => "localhost:1883", "connected" => true, "reachable" => true)
    end

    it "is ok when the broker answers and FixFlow is subscribed, and says when it last heard from it" do
      with_env("MQTT_HOST" => "mqtt.acme.test", "MQTT_PORT" => "1884")
      server("mqtt.acme.test")
      allow(Iot::MqttStatus).to receive(:read).and_return({ connected: true, last_message_at: Time.utc(2026, 10, 17, 9, 30) })
      expect(health["mqtt"]).to include("status" => "ok", "broker" => "mqtt.acme.test:1884", "reachable" => true, "connected" => true,
                                        "last_message_at" => "2026-10-17T09:30:00Z")
    end

    it "warns when the broker answers but FixFlow is not subscribed" do
      with_env("MQTT_HOST" => "mqtt.acme.test")
      server("mqtt.acme.test")
      allow(Iot::MqttStatus).to receive(:read).and_return({ connected: false, last_message_at: nil })
      mqtt = health["mqtt"]
      expect(mqtt).to include("status" => "warning", "connected" => false, "last_message_at" => nil)
      expect(mqtt["message"]).to include("not subscribed")
    end

    it "is an error when the broker does not answer" do
      with_env("MQTT_HOST" => "mqtt.acme.test")
      server("mqtt.acme.test", working: false)
      expect(health["mqtt"]).to include("status" => "error", "reachable" => false)
    end

    it "still answers when Redis cannot say whether the subscriber is connected" do
      with_env("MQTT_HOST" => "mqtt.acme.test")
      server("mqtt.acme.test")
      allow(Iot::MqttStatus).to receive(:read).and_raise(Redis::CannotConnectError)
      expect(health["mqtt"]).to include("status" => "warning", "connected" => false)
    end
  end

  describe "file storage" do
    it "reports the service in use" do
      expect(health["storage"]).to include("status" => "ok", "service" => "Disk")
    end

    it "warns, rather than failing, when storage does not answer" do
      allow(ActiveStorage::Blob.service).to receive(:exist?).and_raise(Errno::ECONNREFUSED)
      storage = health["storage"]
      expect(storage).to include("status" => "warning")
      expect(storage["message"]).to include("photos and documents")
    end
  end

  describe "the overall status" do
    it "is the worst of the checks" do
      allow(EmailSetup).to receive(:source).and_return(:environment)
      server("smtp.acme.test")
      with_env("SMTP_HOST" => "smtp.acme.test")
      expect(health["status"]).to eq("ok")
      allow(EmailSetup).to receive(:source).and_return(nil)
      expect(health["status"]).to eq("warning")
      workers(count: 0)
      expect(health["status"]).to eq("error")
    end
  end

  describe "the update check" do
    def latest(tag, url = "https://github.com/GetFixFlow/fixflow/releases/tag/#{tag}")
      stub_request(:get, release).to_return(status: 200, body: { tag_name: tag, html_url: url }.to_json)
    end

    it "says when a newer release exists, and links to it" do
      with_env("APP_VERSION" => "0.1.0")
      latest("v0.2.0")
      update = health["update"]
      expect(update).to include("status" => "warning", "enabled" => true, "current" => "0.1.0", "latest" => "0.2.0",
                                "url" => "https://github.com/GetFixFlow/fixflow/releases/tag/v0.2.0")
      expect(update["message"]).to include("Version 0.2.0 is available")
    end

    it "says you are up to date, and sends nothing but a request naming the version" do
      with_env("APP_VERSION" => "0.2.0")
      latest("v0.2.0")
      expect(health["update"]).to include("status" => "ok", "latest" => "0.2.0")
      expect(WebMock).to have_requested(:get, release).with(headers: { "User-Agent" => "FixFlow/0.2.0 (update check)" })
    end

    it "does not ask GitHub at all when the company has turned the check off" do
      org.assign_company_settings("update_check" => false)
      org.save!
      update = health["update"]
      expect(update).to include("status" => "off", "enabled" => false, "locked" => false)
      expect(WebMock).not_to have_requested(:get, release)
    end

    it "does not ask GitHub when the server's environment turns it off, whatever the company chose" do
      with_env("FIXFLOW_UPDATE_CHECK" => "false")
      update = health["update"]
      expect(update).to include("status" => "off", "enabled" => false, "locked" => true)
      expect(update["message"]).to include("FIXFLOW_UPDATE_CHECK=false")
      expect(WebMock).not_to have_requested(:get, release)
    end

    it "does not fail the page when GitHub cannot be reached" do
      stub_request(:get, release).to_timeout
      update = health["update"]
      expect(update).to include("status" => "unknown", "latest" => nil)
      expect(update["message"]).to include("Could not look up the latest release", "does not affect FixFlow")
      stub_request(:get, release).to_return(status: 500)
      expect(health["update"]["message"]).to include("GitHub answered 500")
    end

    it "says so when no release has been published yet" do
      expect(health["update"]).to include("status" => "ok", "latest" => nil)
      expect(health["update"]["message"]).to include("No release has been published")
    end
  end

  describe "turning the update check off from the company settings" do
    it "is saved, and by an administrator only" do
      patch "/api/v1/organization_settings", params: { organization: { update_check: false } }, headers: auth_headers_for(admin),
as: :json
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body.dig("organization", "update_check")).to be(false)
      expect(org.reload.settings_with_defaults["update_check"]).to be(false)

      patch "/api/v1/organization_settings", params: { organization: { update_check: true } },
                                             headers: auth_headers_for(create(:user, :manager, organization: org)), as: :json
      expect(response).to have_http_status(:forbidden)
    end

    it "is on until someone turns it off" do
      get "/api/v1/organization_settings", headers: auth_headers_for(admin)
      expect(response.parsed_body.dig("organization", "update_check")).to be(true)
    end
  end
end
