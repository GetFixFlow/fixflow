require "rails_helper"
require "open3"

# Production loads every file at boot (eager_load = true) and builds the storage
# service named in config/environments/production.rb. Development and test load
# lazily, so mistakes here only show up when the container starts.
RSpec.describe "Production boot requirements" do
  it "loads every autoloaded file with the name Zeitwerk expects" do
    expect { Rails.autoloaders.main.eager_load(force: true) }.not_to raise_error
  end

  describe "Active Storage services" do
    let(:defined_services) do
      YAML.safe_load(ERB.new(Rails.root.join("config/storage.yml").read).result, aliases: true).keys
    end

    %w[development test production].each do |env|
      it "defines the service that #{env} selects" do
        config = Rails.root.join("config/environments/#{env}.rb").read
        selected = config[/active_storage\.service\s*=\s*:(\w+)/, 1]

        expect(selected).to be_present
        expect(defined_services).to include(selected)
      end
    end

    it "gives the minio service the credentials that .env.example and the production compose file set" do
      env = { "MINIO_ACCESS_KEY" => "fixflow_minio", "MINIO_SECRET_KEY" => "s3cr3t" }
      rendered = with_env(env) { YAML.safe_load(ERB.new(Rails.root.join("config/storage.yml").read).result, aliases: true) }

      expect(rendered["minio"]).to include("access_key_id" => "fixflow_minio", "secret_access_key" => "s3cr3t")
    end

    def with_env(vars)
      saved = vars.keys.to_h { |k| [k, ENV[k]] }
      vars.each { |k, v| ENV[k] = v }
      yield
    ensure
      saved.each { |k, v| v.nil? ? ENV.delete(k) : ENV[k] = v }
    end
  end

  # production.rb is not loaded by the other specs, so start a real production process and ask it. With assume_ssl on,
  # Action Cable takes every request to be https://, so an install served over http:// is refused unless it is listed.
  describe "Action Cable origins" do
    def origins_in_production(env)
      base = { "PATH" => ENV.fetch("PATH"), "HOME" => Dir.home, "RAILS_ENV" => "production", "SECRET_KEY_BASE_DUMMY" => "1",
               "SKIP_CONFIG_CHECK" => "true", "DEVISE_JWT_SECRET_KEY" => "x" * 40, "REDIS_URL" => "redis://localhost:6379/0" }
      script = "puts ActionCable.server.config.allowed_request_origins.to_json"
      out, status = Open3.capture2e(base.merge(env), "bin/rails", "runner", script, chdir: Rails.root.to_s, unsetenv_others: true)

      raise "production did not start: #{out}" unless status.success?

      JSON.parse(out.lines.last)
    end

    it "accepts the address people open FixFlow at, and the other addresses allowed to call it" do
      origins = origins_in_production("APP_URL" => "http://fixflow.test:8088/", "ALLOWED_ORIGINS" => "https://other.test")

      expect(origins).to eq(%w[http://fixflow.test:8088 https://other.test])
    end
  end
end
