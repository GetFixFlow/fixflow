require "rails_helper"
require "fixflow_config_check"
require "open3"
require "tmpdir"

# deploy/install.sh sets up a fresh Ubuntu server. The parts that need root, apt and Docker cannot run in a test; what it
# DECIDES (the .env it writes, the options it accepts) can, with --env-only, and the .env is held to the standard the
# server holds every .env to: FixflowConfigCheck, and every setting the compose file requires.
RSpec.describe "deploy/install.sh" do
  let(:script) { Rails.root.join("deploy/install.sh").to_s }
  let(:dir)    { Dir.mktmpdir("fixflow_install") }

  before { FileUtils.cp(Rails.root.join(".env.example"), dir) }

  after  { FileUtils.remove_entry(dir) }

  def install(*args, env_only: true)
    flags = env_only ? ["--env-only", "--dir", dir] : ["--dir", dir]
    Open3.capture3("sh", script, *flags, *args)
  end

  # What a process gets from the file: the last line for a setting wins, and a comment after the value is not part of it.
  def written_env
    File.readlines(File.join(dir, ".env"), chomp: true).each_with_object({}) do |line, env|
      next unless (match = line.match(/\A([A-Z][A-Z0-9_]*)=(.*)\z/))

      env[match[1]] = match[2].sub(/\s+#.*\z/, "").strip
    end
  end

  def required_by(compose_file)
    Rails.root.join(compose_file).read.scan(/\$\{([A-Z][A-Z0-9_]*):\?/).flatten.uniq
  end

  # The server checks the environment its container gets: .env plus the addresses the compose file builds from it.
  def problems_of(env)
    built = { "DATABASE_URL" => "postgres://fixflow:#{env['DB_PASSWORD']}@db/fixflow_production",
              "REDIS_URL" => "redis://:#{env['REDIS_PASSWORD']}@redis:6379/0" }
    FixflowConfigCheck.new(env.merge(built)).problems
  end

  context "with nothing but --env-only (the full install, plain HTTP)" do
    it "writes a .env that the server accepts, with every setting the compose file requires, and tells nobody the secrets" do
      out, err, status = install

      expect(status).to be_success, err
      expect(out).not_to match(/[0-9a-f]{40}/) # no secret is printed
      env = written_env
      expect(problems_of(env)).to eq([])
      expect(required_by("docker-compose.prod.yml")).to all(satisfy { |name| env[name].to_s.size.positive? })
      expect(env["SECRET_KEY_BASE"].size).to be >= 64
      expect(env["DEVISE_JWT_SECRET_KEY"].size).to be >= 32
      expect(env["APP_URL"]).to match(%r{\Ahttp://[^/\s]+\z})
    end

    it "makes different secrets every time, and a file only its owner can read" do
      install
      first = written_env
      mode = File.stat(File.join(dir, ".env")).mode & 0o777
      FileUtils.rm(File.join(dir, ".env"))
      install

      expect(mode).to eq(0o600)
      %w[SECRET_KEY_BASE DEVISE_JWT_SECRET_KEY DB_PASSWORD REDIS_PASSWORD MINIO_SECRET_KEY MQTT_PASSWORD].each do |name|
        expect(written_env[name]).not_to eq(first[name])
      end
    end

    it "leaves .env.example's own text alone and adds its lines at the end" do
      install

      example = File.read(File.join(dir, ".env.example"))
      expect(File.read(File.join(dir, ".env"))).to start_with(example)
    end

    it "does not turn on HTTPS or the lite install" do
      install

      expect(written_env.keys).not_to include("COMPOSE_PROFILES", "HTTPS_DOMAIN", "COMPOSE_FILE")
    end
  end

  context "with --url" do
    it "uses the address given, and its port for the web front door" do
      install("--url", "http://10.0.0.5:8080")

      expect(written_env).to include("APP_URL" => "http://10.0.0.5:8080", "HTTP_PORT" => "8080")
      expect(problems_of(written_env)).to eq([])
    end

    it "leaves the port alone for an address without one" do
      install("--url", "http://fixflow.company.local")

      expect(written_env["APP_URL"]).to eq("http://fixflow.company.local")
      expect(written_env["HTTP_PORT"]).to eq("80") # .env.example's own
    end
  end

  context "with --domain" do
    it "turns on HTTPS with a free certificate, and moves the plain-HTTP door away, shut to the network" do
      install("--domain", "fixflow.example.com", "--email", "it@example.com")

      env = written_env
      expect(env).to include("APP_URL" => "https://fixflow.example.com", "COMPOSE_PROFILES" => "https", "HTTPS_DOMAIN" => "fixflow.example.com",
                             "HTTPS_MODE" => "automatic", "HTTPS_EMAIL" => "it@example.com", "HTTP_PORT" => "8080", "HTTP_BIND" => "127.0.0.1")
      expect(problems_of(env)).to eq([]) # the HTTPS checks too: APP_URL, the port, the bind
    end

    it "does not write an email it was not given" do
      install("--domain", "fixflow.example.com")

      expect(written_env.keys).not_to include("HTTPS_EMAIL")
      expect(problems_of(written_env)).to eq([])
    end
  end

  context "with --lite" do
    it "chooses the lite compose file, drops the settings it does not use, and still has everything the file requires" do
      install("--lite")

      env = written_env
      expect(env["COMPOSE_FILE"]).to eq("docker-compose.lite.yml")
      expect(env.keys.grep(/\A(MINIO|MQTT)_/)).to eq([])
      expect(required_by("docker-compose.lite.yml")).to all(satisfy { |name| env[name].to_s.size.positive? })
      expect(problems_of(env)).to eq([])
    end

    it "works with a domain too" do
      install("--lite", "--domain", "fixflow.example.com")

      expect(written_env).to include("COMPOSE_FILE" => "docker-compose.lite.yml", "HTTPS_DOMAIN" => "fixflow.example.com")
      expect(problems_of(written_env)).to eq([])
    end
  end

  context "when it is asked for something it should not do" do
    it "never overwrites an .env" do
      File.write(File.join(dir, ".env"), "KEEP=me\n")

      _, err, status = install

      expect(status).not_to be_success
      expect(err).to include(".env already exists")
      expect(File.read(File.join(dir, ".env"))).to eq("KEEP=me\n")
    end

    it "refuses a folder that is not a FixFlow checkout" do
      FileUtils.rm(File.join(dir, ".env.example"))

      _, err, status = install

      expect(status).not_to be_success
      expect(err).to include("not a FixFlow checkout")
    end

    {
      %w[--domain a.example.com --url http://b.example.com] => "not both",
      %w[--email it@example.com] => "--email is for --domain",
      %w[--domain https://a.example.com] => "a name only",
      %w[--domain a.example.com/path] => "a name only",
      %w[--url fixflow.company.local] => "--url looks like",
      %w[--url http://host/] => "--url looks like",
      %w[--version 0.2.0] => "--version looks like",
      %w[--frobnicate] => "I do not know --frobnicate"
    }.each do |args, message|
      it "refuses #{args.join(' ')} with a plain message, before writing anything" do
        _, err, status = install(*args)

        expect(status).not_to be_success
        expect(err).to include(message)
        expect(File).not_to exist(File.join(dir, ".env"))
      end
    end

    it "wants root for a real install, and says so before touching the system" do
      skip "the tests are running as root" if Process.uid.zero?

      _, err, status = install("--domain", "fixflow.example.com", env_only: false)

      expect(status).not_to be_success
      expect(err).to include("Run this as root")
    end
  end

  describe "the script itself" do
    it "is executable, valid shell, and says in its first lines what it does" do
      expect(File.executable?(script)).to be(true)
      expect(system("sh", "-n", script)).to be(true)
      expect(File.read(script).lines.first(4).join).to include("one command")
    end

    it "passes shellcheck, when that is installed" do
      skip "shellcheck is not installed" unless system("command -v shellcheck >/dev/null 2>&1")

      expect(system("shellcheck", "-s", "sh", script)).to be(true)
    end

    it "prints its own header as help" do
      out, _, status = Open3.capture3("sh", script, "--help")

      expect(status).to be_success
      expect(out).to include("--domain NAME", "--lite", "--env-only")
    end
  end
end
