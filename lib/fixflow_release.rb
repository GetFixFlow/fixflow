require "date"

# The version number and the release notes, kept in two places that have to agree: the VERSION file (what the running
# server reports, and what the release tag must match) and CHANGELOG.md (one section per release). Plain Ruby, so
# bin/release, bin/release_notes and the release workflow can use it without booting Rails.
module FixflowRelease
  class Error < StandardError; end

  ROOT = File.expand_path("..", __dir__)
  VERSION_FILE = File.join(ROOT, "VERSION")
  CHANGELOG_FILE = File.join(ROOT, "CHANGELOG.md")

  SEMVER = /\A\d+\.\d+\.\d+(-[0-9A-Za-z.]+)?\z/
  UNRELEASED = "## [Unreleased]".freeze
  # A line in a changelog bullet that tells the person running the server to do something. Put it last in the bullet.
  UPGRADE_NOTE = /\*\*Upgrade:\*\*\s*(.+?)(?=\s\*\*|$)/

  # What this server reports as its version: APP_VERSION when the person running it set one, else the VERSION file.
  def self.current(env = ENV)
    custom = env["APP_VERSION"].to_s.strip
    custom.empty? ? File.read(VERSION_FILE).strip : custom
  end

  def self.valid?(version) = version.to_s.match?(SEMVER)

  def self.newer?(version, than) = Gem::Version.new(version) > Gem::Version.new(than)

  # The versions with a section in the changelog, newest first.
  def self.released_versions(changelog)
    changelog.scan(/^## \[(\d[^\]]*)\]/).flatten.sort_by { |version| Gem::Version.new(version) }.reverse
  end

  # The text of one release's section, without its heading.
  def self.section(changelog, version)
    heading = changelog.match(/^## \[#{Regexp.escape(version)}\][^\n]*\n/) or raise Error, "CHANGELOG.md has no section for #{version}."
    body = heading.post_match.split(/^## /, 2).first.to_s.strip
    raise Error, "The #{version} section of CHANGELOG.md is empty." if body.empty?

    body
  end

  # The changelog with what was under [Unreleased] moved into a section for the new version.
  # (Plain Ruby that runs without Rails, so there is no Time.zone to use.)
  def self.cut(changelog, version, date: Date.today) # rubocop:disable Rails/Date
    raise Error, "#{version} is not a version number like 1.2.3." unless valid?(version)
    raise Error, "CHANGELOG.md already has a section for #{version}." if released_versions(changelog).include?(version)

    start = changelog.index(UNRELEASED) or raise Error, "CHANGELOG.md has no #{UNRELEASED} section."
    body_start = start + UNRELEASED.length
    body = changelog[body_start..].split(/^## /, 2).first.to_s
    raise Error, "Nothing is waiting under #{UNRELEASED} in CHANGELOG.md." if body.strip.empty?

    changelog.sub(UNRELEASED, "#{UNRELEASED}\n\n## [#{version}] - #{date.iso8601}")
  end

  # The "Upgrade:" notes of a release, each with the start of the bullet it came from.
  def self.upgrade_notes(section_text)
    section_text.lines.filter_map do |line|
      note = line[UPGRADE_NOTE, 1] or next
      title = line[/\A- (.+?[.:])(\s|\z)/, 1] || line.delete_prefix("- ")[0, 60].strip
      "#{title} #{note.strip}"
    end
  end

  # What goes on the release page: how to upgrade, anything the person running the server must do, then the changes.
  def self.notes(changelog, version)
    body = section(changelog, version)
    todo = upgrade_notes(body)
    lines = ["## Upgrading to #{version}", ""]
    if todo.any?
      lines << "**Before you upgrade, read this:**" << ""
      lines.concat(todo.map { |text| "- #{text}" })
      lines << ""
    end
    lines << "Back up and upgrade with `make upgrade TO=v#{version}`; `make rollback CONFIRM=yes` puts the previous version and " \
             "its database back. Migrations run when the server starts. The steps are in the README, under " \
             "\"Upgrading and rolling back\"."
    lines << "" << "## What changed" << "" << body
    lines.join("\n")
  end
end
