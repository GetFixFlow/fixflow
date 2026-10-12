require "rails_helper"

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
end
