require "rails_helper"
require "fixflow_api_docs"
require "rake"
require "open3"

# The docs (docs/*.md, built by mkdocs.yml) are only worth reading while they match the program. `mkdocs build --strict`
# (the `docs` CI job) checks the links between pages; these check what it cannot: that the list of endpoints is the routes,
# and that the commands the pages tell people to type exist.
RSpec.describe "The docs" do
  def read(path) = Rails.root.join(path).read

  let(:pages) { Rails.root.glob("docs/*.md").reject { |page| page.basename.to_s.include?("Proposal") } }
  let(:text)  { pages.map(&:read).join("\n") }

  it "has pages" do
    names = pages.map { |page| page.basename.to_s }

    expect(names).to include("index.md", "install.md", "upgrading.md", "backups.md", "troubleshooting.md", "api.md")
  end

  describe "the list of endpoints (docs/api-endpoints.md)" do
    it "is what `rails docs:api` writes from the routes, so a new endpoint is listed once that is run" do
      expect(read("docs/api-endpoints.md")).to eq(FixflowApiDocs.markdown),
                                               "docs/api-endpoints.md is out of date: run `bin/rails docs:api` and commit it"
    end

    it "lists the address of every endpoint of the API" do
      paths = Rails.application.routes.routes.map { |route| route.path.spec.to_s.delete_suffix("(.:format)") }
                   .select { |path| path.start_with?("/api/v1/") }.uniq
      page = read("docs/api-endpoints.md")

      expect(paths.size).to be > 100
      expect(paths.reject { |path| page.include?("`#{path}`") }).to eq([])
    end
  end

  describe "the commands the pages tell people to type" do
    it "are all there: every `fixflow:` rake task" do
      Rails.application.load_tasks unless Rake::Task.task_defined?("fixflow:create_admin") # once: loading twice runs tasks twice
      named = text.scan(/\bfixflow:[a-z_]+/).uniq

      expect(named).not_to be_empty
      expect(named.reject { |name| Rake::Task.task_defined?(name) }).to eq([])
    end

    it "are all there: every `make` target in a code span" do
      targets = read("Makefile").scan(/^([a-z][a-z-]*):/).flatten
      named = text.scan(/`make ([a-z][a-z-]*)[^`]*`/).flatten.uniq

      expect(named).to include("upgrade", "restore", "prod")
      expect(named - targets).to eq([])
    end

    it "are all there: every `bin/` script" do
      named = text.scan(%r{`(bin/[a-z_]+)}).flatten.uniq

      expect(named).to include("bin/check_upgrade")
      expect(named.reject { |script| Rails.root.join(script).exist? }).to eq([])
    end
  end

  describe "the install script the pages tell people to download" do
    let(:script) { Rails.root.join("deploy/install.sh") }

    it "is the file the pages download, and has every option they name" do
      help = Open3.capture2("sh", script.to_s, "--help").first
      lines = text.lines.select { |line| line.include?("install.sh") || line.start_with?("| `--") }
      used = lines.flat_map { |line| line.scan(/--[a-z][a-z-]+/) }.uniq

      expect(text).to include("raw.githubusercontent.com/GetFixFlow/fixflow/main/deploy/install.sh")
      expect(used).to include("--domain", "--lite", "--https-mode", "--url")
      expect(used.reject { |option| help.include?(option) }).to eq([])
    end
  end

  describe "the places that point at the docs" do
    it "link only to files that exist (the README, CONTRIBUTING.md and the pages' links out of docs/)" do
      broken = %w[README.md CONTRIBUTING.md].flat_map do |file|
        links = read(file).scan(/\]\(([^)#\s]+)(?:#[^)]*)?\)/).flatten.grep_v(/\A(https?:|mailto:)/)
        links.reject { |link| Rails.root.join(link).exist? }.map { |link| "#{file}: #{link}" }
      end

      expect(broken).to eq([])
    end
  end

  describe "the site build" do
    it "pins what it installs, so a new release of MkDocs cannot break a release" do
      requirements = read("deploy/docs/requirements.txt").lines.map(&:strip).reject { |line| line.empty? || line.start_with?("#") }

      expect(requirements).not_to be_empty
      expect(requirements).to all(match(/\A[a-z-]+==\d+\.\d+\.\d+\z/))
    end

    it "is built strictly in CI, and again, attached and published, by every release" do
      ci = YAML.safe_load(read(".github/workflows/ci.yml"), aliases: true)
      release = YAML.safe_load(read(".github/workflows/release.yml"), aliases: true)

      expect(ci.dig("jobs", "docs", "steps").pluck("run").compact).to include("mkdocs build --strict")
      steps = release.dig("jobs", "docs", "steps").pluck("run").compact.join("\n")
      expect(steps).to include("mkdocs build --strict", "gh release upload", "mike deploy --push")
      expect(release.dig("jobs", "docs", "needs")).to eq("release")
    end

    it "puts every page in the navigation, and builds strictly" do
      config = YAML.safe_load(read("mkdocs.yml"), aliases: true)
      in_nav = config["nav"].flat_map(&:values).flat_map { |value| value.is_a?(Array) ? value.flat_map(&:values) : value }

      expect(config["strict"]).to be(true)
      expect(pages.map { |page| page.basename.to_s } - in_nav).to eq([])
      expect(in_nav - pages.map { |page| page.basename.to_s } - ["changelog.md"]).to eq([])
    end
  end
end
