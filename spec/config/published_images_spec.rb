require "rails_helper"
require "fixflow_release"
require "open3"

# An install can run from published images: the compose files name them after the release, bin/up pulls them when the
# folder is exactly a release, and the release workflow builds them. bin/check_images runs the real thing (a registry
# started in CI); these keep the parts it relies on in place.
RSpec.describe "Published images" do
  def read(path) = Rails.root.join(path).read

  let(:version) { read("VERSION").strip }

  %w[docker-compose.prod.yml docker-compose.lite.yml].each do |file|
    describe file do
      let(:services) { YAML.safe_load(read(file), aliases: true).fetch("services") }

      it "names the api and web images after the release, in a registry that can be changed, and never 'latest'" do
        %w[api web].each do |name|
          repo = "${FIXFLOW_IMAGE_REPO:-ghcr.io/getfixflow}"
          expect(services.dig(name, "image")).to eq("#{repo}/fixflow-#{name}:${FIXFLOW_VERSION:-#{version}}")
          expect(services.dig(name, "build")).to be_present # still built from source when nothing is published
        end
        expect(read(file)).not_to match(/image:.*:latest/)
      end

      it "has the default version of the VERSION file, so a plain `docker compose` and bin/up name the same image" do
        expect(read(file).scan(/\$\{FIXFLOW_VERSION:-([^}]*)\}/).flatten.uniq).to eq([version])
      end

      it "runs the worker from the api's image, which it never pulls or builds itself" do
        expect(services.dig("sidekiq", "image")).to eq(services.dig("api", "image"))
        expect(services.dig("sidekiq", "pull_policy")).to eq("never")
        expect(services["sidekiq"]).not_to have_key("build")
      end
    end
  end

  describe "bin/up" do
    it "is an executable shell script that parses" do
      expect(Rails.root.join("bin/up")).to be_executable
      _, status = Open3.capture2e("sh", "-n", Rails.root.join("bin/up").to_s)
      expect(status).to be_success
    end

    it "is what `make prod` and the install script run, and pulls only when the folder is exactly a release" do
      expect(read("Makefile")).to match(%r{^prod:\n\t@\./bin/up$})
      expect(read("deploy/install.sh")).to include("if ! bin/up; then")
      expect(read("bin/up")).to include("git describe --exact-match --tags", 'v$(cat VERSION)', "FIXFLOW_BUILD", "FIXFLOW_PULL")
    end
  end

  describe "bin/upgrade and bin/rollback" do
    %w[bin/upgrade bin/rollback].each do |script|
      it "#{script} pulls the published images only on an exact release, and builds otherwise" do
        text = read(script)

        expect(text).to include("pulled_images", "git describe --exact-match --tags", "--build")
      end
    end
  end

  describe "the release workflow's images job" do
    let(:workflow) { YAML.safe_load(read(".github/workflows/release.yml"), aliases: true) }
    let(:job) { workflow.dig("jobs", "images") }
    let(:build) { job["steps"].find { |step| step["uses"].to_s.start_with?("docker/build-push-action") } }

    it "runs after the release is checked, and may write packages" do
      expect(job["needs"]).to eq("release")
      expect(job.dig("permissions", "packages")).to eq("write")
    end

    it "builds the api and the web image for Intel and ARM and pushes the exact version, with no 'latest'" do
      expect(job.dig("strategy", "matrix", "include").pluck("name")).to eq(%w[api web])
      expect(build.dig("with", "platforms")).to eq("linux/amd64,linux/arm64")
      expect(build.dig("with", "push")).to be(true)
      steps = job["steps"].map { |step| [step["run"], step.dig("with", "tags")] }.flatten.compact.join("\n")
      expect(steps).to include("fixflow-$NAME:${TAG#v}")
      expect(steps).not_to include("latest")
    end

    it "makes the registry name lower case, which the organisation's name is not" do
      expect(job["steps"].pluck("run").compact.join("\n")).to include("${GITHUB_REPOSITORY_OWNER,,}")
    end
  end

  describe "the CI job" do
    it "runs bin/check_images" do
      ci = YAML.safe_load(read(".github/workflows/ci.yml"), aliases: true)

      expect(ci.dig("jobs", "images", "steps").pluck("run").compact).to include("bin/check_images")
      expect(Rails.root.join("bin/check_images")).to be_executable
    end
  end
end
