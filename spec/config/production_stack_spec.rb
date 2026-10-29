require "rails_helper"

# A production install is a compose file, two Dockerfiles and an nginx config. Nothing else in the suite starts them
# together, and they went unstarted for so long that every one of them was broken. These check the rules whose breaking
# was found when the stack was first started for real (bin/check_production_stack does that start, in CI).
RSpec.describe "The production stack" do
  def read(path) = Rails.root.join(path).read

  let(:compose)     { YAML.safe_load(read("docker-compose.prod.yml"), aliases: true) }
  let(:dev_compose) { YAML.safe_load(read("docker-compose.yml"), aliases: true) }
  let(:services)    { compose.fetch("services") }
  let(:env_example) { read(".env.example") }
  let(:nginx)       { read("apps/web/nginx.conf") }

  def location(name)
    nginx[/^\s*location\s+#{Regexp.escape(name)}\s*\{(.*?)^    \}/m, 1] || raise("no location #{name} in nginx.conf")
  end

  describe "docker-compose.prod.yml" do
    it "waits only for services that exist, and for a health check only where the service has one" do
      services.each do |name, service|
        Array(service["depends_on"]).each do |target, rule|
          expect(services).to have_key(target), "#{name} waits for #{target}, which is not a service"
          next unless rule.is_a?(Hash) && rule["condition"] == "service_healthy"

          expect(services[target]).to have_key("healthcheck"),
                                      "#{name} waits for #{target} to be healthy, but #{target} has no health check"
        end
      end
    end

    it "publishes the web front door, the HTTPS one and the sensor broker to the network, and nothing else" do
      published = services.transform_values { |service| Array(service["ports"]).map { |port| port.to_s.rpartition(":").first } }
      published.reject! { |_, ports| ports.empty? }

      expect(published.keys).to contain_exactly("web", "mqtt", "https")
      expect(published["web"]).to eq(["${HTTP_BIND:-0.0.0.0}:${HTTP_PORT:-80}"])
      expect(published["mqtt"]).to eq(["1883"])
      expect(published["https"]).to eq(["${HTTPS_HTTP_PORT:-80}", "${HTTPS_PORT:-443}"])
    end

    it "is complete by itself: it names the project, and no service extends another file" do
      expect(compose["name"]).to eq("fixflow")
      expect(services.values.flat_map(&:keys)).not_to include("extends")
    end

    it "gives the api and the worker the same settings, from .env first" do
      expect(services["api"]["env_file"]).to eq(".env")
      expect(services["sidekiq"]["env_file"]).to eq(".env")
      expect(services["sidekiq"]["environment"]).to eq(services["api"]["environment"])
    end

    it "sets the bucket names itself, so the app and the setup task cannot look in different ones" do
      environment = services["api"]["environment"]

      expect(environment["MINIO_BUCKET"]).to eq("${MINIO_BUCKET:-fixflow-uploads}")
      expect(environment["MINIO_BACKUP_BUCKET"]).to eq("${MINIO_BACKUP_BUCKET:-fixflow-backups}")
    end

    it "gives the file storage the same login the app uses" do
      expect(services["s3"]["environment"]).to include("AWS_ACCESS_KEY_ID" => a_string_including("MINIO_ACCESS_KEY"),
                                                       "AWS_SECRET_ACCESS_KEY" => a_string_including("MINIO_SECRET_KEY"))
      expect(services["api"]["environment"]["MINIO_ENDPOINT"]).to eq("http://s3:8333")
    end

    it "writes the broker's password file where the broker's configuration reads it" do
      path = read("config/mosquitto/mosquitto.conf")[/^password_file\s+(\S+)/, 1]
      command = services["mqtt"]["command"].join(" ")

      expect(path).to be_present
      expect(command).to include("mosquitto_passwd -b -c #{path}")
      expect(command).to include("chown mosquitto:mosquitto #{path}") # it runs as that user, and the file is made by root
      expect(command).to include("rm -f #{path}") # a restarted container keeps the old file; mosquitto_passwd will not overwrite it
    end

    it "does not leave Redis free to throw away the background jobs it holds" do
      expect(services["redis"]["command"]).to include("--maxmemory-policy noeviction")
    end
  end

  describe "settings" do
    it "has every setting the compose files read in .env.example, and every setting compose requires filled in by hand" do
      text = read("docker-compose.prod.yml")
      read_by_compose = text.scan(/\$\{([A-Z][A-Z0-9_]*)/).flatten.uniq
      listed = env_example.scan(/^#?\s*([A-Z][A-Z0-9_]*)=/).flatten
      required = text.scan(/\$\{([A-Z][A-Z0-9_]*):\?/).flatten.uniq

      expect(read_by_compose - listed).to eq([])
      required.each do |name|
        expect(env_example).to match(/^#{name}=/), "#{name} is required by the compose file, so .env.example must list it uncommented"
      end
    end

    it "sets nothing in either compose file that the app never reads" do
      files = %w[app config lib bin db].flat_map { |dir| Dir[Rails.root.join(dir, "**/*").to_s] }.select { |file| File.file?(file) }
      source = files.map { |file| File.read(file) }.join("\n")
      names = (services["api"]["environment"].keys + dev_compose["services"]["api"]["environment"].keys +
               dev_compose["services"]["sidekiq"]["environment"].keys).uniq

      unread = names.reject { |name| name == "RAILS_ENV" || source.include?(name) } # Rails itself reads RAILS_ENV
      expect(unread).to eq([]), "set in a compose file but read nowhere: #{unread.join(', ')}"
    end
  end

  describe "images" do
    it "pins every image to a version (no latest, no moving tag)" do
      both = services.values + dev_compose["services"].values
      built_here = both.filter_map { |service| service["image"] if service["build"] }
      images = both.filter_map { |service| service["image"] unless service["build"] || built_here.include?(service["image"]) }

      expect(images).to all(match(/:\d+\.\d+/)), "unpinned: #{images.grep_v(/:\d+\.\d+/).join(', ')}"
      expect(images.grep(/latest/)).to eq([])
    end

    it "pins the images the Dockerfiles start from" do
      froms = [read("Dockerfile"), read("apps/web/Dockerfile")].flat_map { |text| text.scan(/^FROM\s+(\S+)/).flatten }

      expect(froms).to all(match(/:\d+\.\d+\.\d+/)), "unpinned: #{froms.grep_v(/:\d+\.\d+\.\d+/).join(', ')}"
    end

    it "installs the library psych needs to build (without it bundle install stops and nothing builds)" do
      expect(read("Dockerfile")[/apk add.*?\n\n/m]).to include("yaml-dev")
    end

    it "keeps the web app's sources and dependencies out of the api image and node_modules out of the web image" do
      expect(read(".dockerignore")).to match(%r{^/apps/}).and match(%r{^/spec/})
      expect(read("apps/web/.dockerignore")).to match(/^node_modules$/).and match(/^\.env\*$/)
    end

    it "builds the web app with a relative API address, not one read from an ignored .env file a fresh clone does not have" do
      dockerfile = read("apps/web/Dockerfile")

      expect(dockerfile).to match(%r{ENV\s+VITE_API_URL=/api/v1})
      expect(dockerfile.index("VITE_API_URL")).to be < dockerfile.index("npm run build")
    end
  end

  describe "HTTPS" do
    let(:modes) { %w[automatic own-certificate internal] }

    it "is a Caddy service that only starts when the https profile is on, and keeps its certificates in volumes" do
      service = services.fetch("https")

      expect(service["profiles"]).to eq(["https"])
      expect(service["image"]).to start_with("caddy:")
      expect(service["volumes"]).to include("caddy_data:/data")
      expect(compose["volumes"]).to include("caddy_data", "caddy_config")
      expect(services.except("https").values.pluck("profiles").compact).to eq([]), "only the https service is optional"
    end

    it "does not require a setting that a plain install has not got (compose reads the whole file, profile on or not)" do
      expect(services.fetch("https").to_s).not_to include(":?")
    end

    it "has a Caddyfile for every mode that hands everything to the web front door and nothing else" do
      expect(Rails.root.glob("deploy/caddy/*.Caddyfile").map { |file| file.basename(".Caddyfile").to_s }).to match_array(modes)
      modes.each do |mode|
        file = read("deploy/caddy/#{mode}.Caddyfile").lines.reject { |line| line.strip.start_with?("#") }.join
        expect(file).to include("{$HTTPS_DOMAIN} {", "reverse_proxy web:80")
        expect(file.scan("reverse_proxy").size).to eq(1)
      end
    end

    it "reads the certificate and key a person was told to put in certs/, which git and the images never get" do
      expect(read("deploy/caddy/own-certificate.Caddyfile")).to include("tls /certs/fixflow.crt /certs/fixflow.key")
      expect(services.fetch("https")["volumes"]).to include("./certs:/certs:ro")
      expect(read(".gitignore").lines.map(&:strip)).to include("/certs/")
      expect(read(".dockerignore").lines.map(&:strip)).to include("/certs/")
    end

    it "is started and checked for real by bin/check_https, which CI runs" do
      expect(Rails.root.join("bin/check_https")).to be_executable
      workflow = YAML.safe_load(read(".github/workflows/ci.yml"), aliases: true)
      expect(workflow.dig("jobs", "https", "steps").pluck("run").compact).to include("bin/check_https")
    end

    it "is documented in .env.example with the modes the config check accepts" do
      expect(env_example).to include("COMPOSE_PROFILES=https", "HTTPS_DOMAIN=", "HTTPS_MODE=automatic", "HTTP_BIND=127.0.0.1")
      expect(FixflowConfigCheck::Https::MODES).to match_array(modes)
    end
  end

  describe "the front door (apps/web/nginx.conf)" do
    it "passes /api on whole: a proxy_pass with a path would strip the /api prefix" do
      expect(location("/api/")).to match(/proxy_pass\s+\$api_upstream;/)
      expect(nginx).not_to match(%r{proxy_pass\s+http://[^;\s]+/;})
    end

    it "looks the api up again as it changes (an upgrade replaces the container), not once at start-up" do
      expect(nginx).to include("resolver 127.0.0.11")
      expect(nginx).to match(%r{set\s+\$api_upstream\s+http://api:3000;})
    end

    it "upgrades /cable to a WebSocket and keeps it open" do
      block = location("/cable")

      expect(block).to include("proxy_http_version 1.1", "proxy_set_header Upgrade $http_upgrade", 'Connection "upgrade"')
      expect(block[/proxy_read_timeout\s+(\d+)s/, 1].to_i).to be >= 600
    end

    it "keeps the port in the Host it passes on: Rails compares a WebSocket's origin with it" do
      [location("/api/"), location("/cable")].each do |block|
        expect(block).to include("proxy_set_header Host $http_host;")
        expect(block).not_to include("Host $host;")
      end
    end

    it "lets a photo through (nginx's own limit is 1 MB)" do
      expect(nginx[/client_max_body_size\s+(\d+)m;/, 1].to_i).to be >= 10
    end

    it "answers its own health check, never caches the app itself, and caches the hashed files for ever" do
      expect(location("= /healthz")).to include("return 200")
      expect(location("/")).to include('"no-cache"').and include("try_files $uri $uri/ /index.html")
      expect(location("/assets/")).to include("immutable")
    end
  end
end
