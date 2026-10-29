require "rails_helper"
require "open3"

# Upgrading is a few shell scripts and a CI job. bin/check_upgrade runs the real thing (an old version with data,
# upgraded and rolled back); these keep the parts it relies on in place.
RSpec.describe "Upgrading and releasing" do
  def read(path) = Rails.root.join(path).read

  %w[bin/upgrade bin/rollback bin/check_upgrade].each do |script|
    describe script do
      it "is an executable shell script that parses" do
        expect(Rails.root.join(script)).to be_executable
        _, status = Open3.capture2e("sh", "-n", Rails.root.join(script).to_s)
        expect(status).to be_success
      end

      it "is one function called on the last line and followed by exit, because a checkout replaces the file while it runs" do
        lines = read(script).lines.map(&:strip).reject { |line| line.empty? || line.start_with?("#") }

        expect(lines.last(2)).to eq(["main \"$@\"", "exit"])
        expect(read(script)).to match(/^main\(\) \{/)
      end
    end
  end

  it "has make targets for both" do
    makefile = read("Makefile")
    expect(makefile).to match(%r{^upgrade:\n\t@\./bin/upgrade "\$\(TO\)"})
    expect(makefile).to match(%r{^rollback:\n\t@\./bin/rollback})
    expect(makefile[/^\.PHONY:.*$/]).to include("upgrade", "rollback")
  end

  it "keeps the record of an upgrade out of git, so it never blocks the next one" do
    expect(read(".gitignore")).to include("/.fixflow_upgrade")
  end

  it "takes the backup before it changes anything, and notes the way back before it checks out the new version" do
    upgrade = read("bin/upgrade")

    expect(upgrade.index("pg_dump")).to be < upgrade.index("git checkout -q \"$target\"")
    expect(upgrade.index(".fixflow_upgrade")).to be < upgrade.index("git checkout -q \"$target\"")
    expect(upgrade).to include("PostgreSQL database dump complete")
  end

  it "wants an explicit yes before a rollback replaces the database" do
    expect(read("bin/rollback")).to include('"${CONFIRM:-}" = "yes"')
  end

  describe "the CI job" do
    let(:workflow) { YAML.safe_load(read(".github/workflows/ci.yml"), aliases: true) }
    let(:job) { workflow.dig("jobs", "upgrade") }

    it "runs bin/check_upgrade with the commit it is merged onto, which is fetch-depth 2" do
      expect(job["steps"].pluck("run").compact).to include("bin/check_upgrade")
      checkout = job["steps"].find { |step| step["uses"].to_s.start_with?("actions/checkout") }
      expect(checkout.dig("with", "fetch-depth")).to eq(2)
    end
  end

  describe "the release workflow" do
    let(:workflow) { YAML.safe_load(read(".github/workflows/release.yml"), aliases: true) }

    it "runs for version tags, may write releases, and publishes the notes bin/release_notes prints" do
      expect(workflow.dig(true, "push", "tags")).to eq(["v*"]).or eq(["v[0-9]*"])
      expect(workflow.dig("permissions", "contents")).to eq("write")
      script = workflow["jobs"].values.flat_map { |job| job["steps"].pluck("run") }.compact.join("\n")
      expect(script).to include("bin/release_notes", "gh release create")
    end

    it "refuses a tag that is not the VERSION file's version" do
      script = workflow["jobs"].values.flat_map { |job| job["steps"].pluck("run") }.compact.join("\n")
      expect(script).to include("VERSION")
    end
  end
end
