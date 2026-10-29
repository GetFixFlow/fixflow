require "rails_helper"
require "fixflow_release"
require "open3"
require "tmpdir"

RSpec.describe FixflowRelease do
  let(:changelog) do
    <<~MD
      # Changelog

      ## [Unreleased]

      - Work orders can be exported. Nothing to do.
      - Reports changed shape. The old ones are gone. **Upgrade:** Run `rails db:migrate`, then sign in again.
      - Photos are smaller. Fewer bytes. **Upgrade:** Set `PHOTO_SIZE` first. **Not tested:** phones.

      ## [1.2.0] - 2026-01-02

      ### Fixed

      - A bug.

      ## [1.1.0] - 2026-01-01

      - The first thing.
    MD
  end

  describe ".current" do
    it "is the VERSION file, unless APP_VERSION says otherwise" do
      expect(described_class.current({})).to eq(Rails.root.join("VERSION").read.strip)
      expect(described_class.current("APP_VERSION" => "9.9.9")).to eq("9.9.9")
      expect(described_class.current("APP_VERSION" => "  ")).to eq(Rails.root.join("VERSION").read.strip)
    end
  end

  describe "the version number and the changelog agree" do
    let(:real_changelog) { Rails.root.join("CHANGELOG.md").read }

    it "has a VERSION that is a version number" do
      expect(described_class).to be_valid(described_class.current({}))
    end

    it "has VERSION equal to the newest released section, so a release changes both together" do
      newest = described_class.released_versions(real_changelog).first
      expect(newest).to eq(described_class.current({})) if newest
    end

    it "keeps an [Unreleased] section for the next release" do
      expect(real_changelog).to include(described_class::UNRELEASED)
    end
  end

  describe ".valid? and .newer?" do
    it "accepts 1.2.3 and 1.2.3-rc.1 and nothing looser" do
      %w[1.2.3 0.1.0 10.20.30 1.2.3-rc.1].each { |version| expect(described_class.valid?(version)).to be(true), version }
      ["1.2", "v1.2.3", "1.2.3.4", "", nil, "latest", "1.2.3 "].each do |version|
        expect(described_class.valid?(version)).to be(false), version.inspect
      end
    end

    it "compares numbers, not text" do
      expect(described_class.newer?("1.10.0", "1.9.0")).to be true
      expect(described_class.newer?("1.2.3", "1.2.3")).to be false
      expect(described_class.newer?("1.2.3", "1.2.4")).to be false
    end
  end

  describe ".released_versions" do
    it "lists the sections newest first, by number, and skips [Unreleased]" do
      text = "## [Unreleased]\n## [1.9.0] - x\n## [1.10.0] - y\n## [0.5.0] - z\n"
      expect(described_class.released_versions(text)).to eq(%w[1.10.0 1.9.0 0.5.0])
    end
  end

  describe ".section" do
    it "returns one release's text, up to the next heading" do
      expect(described_class.section(changelog, "1.2.0")).to eq("### Fixed\n\n- A bug.")
      expect(described_class.section(changelog, "1.1.0")).to eq("- The first thing.")
    end

    it "refuses a version with no section, and a section with nothing in it" do
      expect { described_class.section(changelog, "3.0.0") }.to raise_error(described_class::Error, /no section for 3.0.0/)
      expect { described_class.section("## [2.0.0] - x\n\n## [1.0.0] - y\n- a\n", "2.0.0") }
        .to raise_error(described_class::Error, /2.0.0 section .* is empty/)
    end

    it "does not take 1.2.0 for 1.2.01 or the other way round" do
      expect { described_class.section("## [1.2.01] - x\n- a\n", "1.2.0") }.to raise_error(described_class::Error)
    end
  end

  describe ".cut" do
    it "moves what is under [Unreleased] into a dated section and leaves [Unreleased] empty" do
      cut = described_class.cut(changelog, "1.3.0", date: Date.new(2026, 2, 3))

      expect(cut).to include("## [Unreleased]\n\n## [1.3.0] - 2026-02-03\n\n- Work orders can be exported.")
      expect(described_class.section(cut, "1.3.0")).to include("Work orders can be exported", "Photos are smaller")
      expect(described_class.section(cut, "1.3.0")).not_to include("The first thing")
      expect(described_class.released_versions(cut)).to eq(%w[1.3.0 1.2.0 1.1.0])
    end

    it "refuses an empty [Unreleased], a version already released, and something that is not a version" do
      empty = changelog.sub(/## \[Unreleased\].*?(?=## \[1\.2\.0\])/m, "## [Unreleased]\n\n")
      expect { described_class.cut(empty, "1.3.0") }.to raise_error(described_class::Error, /Nothing is waiting/)
      expect { described_class.cut(changelog, "1.2.0") }.to raise_error(described_class::Error, /already has a section/)
      expect { described_class.cut(changelog, "1.3") }.to raise_error(described_class::Error, /not a version number/)
      expect { described_class.cut("# Changelog\n", "1.3.0") }.to raise_error(described_class::Error, /no ## \[Unreleased\]/)
    end
  end

  describe ".upgrade_notes and .notes" do
    let(:released) { described_class.cut(changelog, "1.3.0") }

    it "collects the Upgrade: notes, each with the start of its bullet, and stops at the next bold text" do
      expect(described_class.upgrade_notes(described_class.section(released, "1.3.0"))).to eq(
        ["Reports changed shape. Run `rails db:migrate`, then sign in again.", "Photos are smaller. Set `PHOTO_SIZE` first."]
      )
    end

    it "puts the notes before the changes, with the upgrade command for this version" do
      notes = described_class.notes(released, "1.3.0")

      expect(notes).to start_with("## Upgrading to 1.3.0")
      expect(notes).to include("make upgrade TO=v1.3.0", "make rollback CONFIRM=yes")
      expect(notes.index("Before you upgrade")).to be < notes.index("What changed")
      expect(notes.index("sign in again")).to be < notes.index("What changed")
    end

    it "does not promise anything to do when a release has no Upgrade: notes" do
      expect(described_class.notes(changelog, "1.2.0")).not_to include("Before you upgrade")
    end
  end

  describe "bin/release, in a repository of its own" do
    def run(dir, *cmd)
      out, status = Open3.capture2e(*cmd, chdir: dir)
      [out, status]
    end

    def git(dir, *args)
      out, status = run(dir, "git", "-c", "user.name=t", "-c", "user.email=t@example.test", *args)
      raise "git #{args.join(' ')}: #{out}" unless status.success?

      out.strip
    end

    let(:dir)    { Dir.mktmpdir }
    let(:origin) { File.join(dir, "origin.git") }
    let(:work)   { File.join(dir, "work") }

    before do
      git(dir, "init", "-q", "--bare", "-b", "main", origin)
      git(dir, "clone", "-q", origin, work)
      # bin/release commits, and a CI runner has no git identity of its own.
      git(work, "config", "user.name", "t")
      git(work, "config", "user.email", "t@example.test")
      FileUtils.mkdir_p([File.join(work, "bin"), File.join(work, "lib")])
      %w[bin/release lib/fixflow_release.rb].each { |file| FileUtils.cp(Rails.root.join(file), File.join(work, file)) }
      File.write(File.join(work, "VERSION"), "1.2.0\n")
      File.write(File.join(work, "CHANGELOG.md"), changelog)
      git(work, "add", ".")
      git(work, "commit", "-q", "-m", "start")
      git(work, "push", "-q", "-u", "origin", "main")
    end

    after { FileUtils.remove_entry(dir) }

    it "commits the new VERSION and the cut changelog on a release branch, and says what to do next" do
      out, status = run(work, "ruby", "bin/release", "1.3.0")

      expect(status).to be_success, out
      expect(git(work, "branch", "--show-current")).to eq("release-1.3.0")
      expect(File.read(File.join(work, "VERSION"))).to eq("1.3.0\n")
      expect(File.read(File.join(work, "CHANGELOG.md"))).to include("## [1.3.0] - ")
      expect(git(work, "log", "-1", "--format=%s")).to eq("Release 1.3.0")
      expect(out).to include("git tag v1.3.0", "Reports changed shape. Run `rails db:migrate`")
      expect(git(work, "status", "--porcelain")).to be_empty
    end

    it "refuses a version that is not newer, a tag that exists, uncommitted changes and a branch other than main" do
      expect(run(work, "ruby", "bin/release", "1.2.0").first).to include("not newer")

      git(work, "tag", "v1.3.0")
      expect(run(work, "ruby", "bin/release", "1.3.0").first).to include("tag v1.3.0 already exists")

      File.write(File.join(work, "stray.txt"), "x")
      expect(run(work, "ruby", "bin/release", "1.4.0").first).to include("uncommitted changes")
      FileUtils.rm(File.join(work, "stray.txt"))

      git(work, "switch", "-q", "-c", "other")
      expect(run(work, "ruby", "bin/release", "1.4.0").first).to include("main branch")
      expect(File.read(File.join(work, "VERSION"))).to eq("1.2.0\n")
    end

    it "refuses when main is behind or ahead of origin" do
      File.write(File.join(work, "more.txt"), "x")
      git(work, "add", ".")
      git(work, "commit", "-q", "-m", "not pushed")

      expect(run(work, "ruby", "bin/release", "1.4.0").first).to include("not the same as origin/main")
    end

    it "changes nothing with --dry-run, and prints the release notes" do
      out, status = run(work, "ruby", "bin/release", "1.3.0", "--dry-run")

      expect(status).to be_success, out
      expect(out).to start_with("## Upgrading to 1.3.0")
      expect(git(work, "branch", "--show-current")).to eq("main")
      expect(File.read(File.join(work, "VERSION"))).to eq("1.2.0\n")
    end
  end
end
