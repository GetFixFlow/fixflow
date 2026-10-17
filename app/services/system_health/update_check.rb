require "net/http"

class SystemHealth
  # Whether a newer FixFlow release exists, from GitHub's "latest release" of the project. It asks only when an
  # administrator opens the health page, only when the check is on, and sends nothing but an ordinary request whose
  # user agent names this version. The answer is kept for 12 hours (15 minutes after a failure), so the page does not
  # ask on every visit.
  class UpdateCheck
    REPOSITORY = "GetFixFlow/fixflow".freeze
    CACHE_KEY = "fixflow:latest_release".freeze
    TIMEOUT = 3
    LOCKED_MESSAGE = "The update check is turned off in the server's settings (FIXFLOW_UPDATE_CHECK=false).".freeze

    # `enabled` is the company's setting; `FIXFLOW_UPDATE_CHECK=false` in the server's environment overrides it.
    def initialize(version:, enabled:, env: ENV)
      @version = version
      @enabled = enabled
      @env = env
    end

    def call
      return result("off", LOCKED_MESSAGE, locked: true) if locked?
      return result("off", "The update check is turned off.") unless @enabled

      release = cached_release
      return unreachable(release[:error]) if release[:error]
      return result("ok", "No release has been published yet.") if release[:tag].nil?

      compare(release)
    end

    private

    def unreachable(reason)
      result("unknown", "Could not look up the latest release (#{reason}). This does not affect FixFlow.")
    end

    def locked? = @env["FIXFLOW_UPDATE_CHECK"].to_s.downcase == "false"

    def result(status, message, locked: false, latest: nil, url: nil)
      { enabled: @enabled && !locked, locked: locked, status: status, message: message, current: @version, latest: latest, url: url }
    end

    def compare(release)
      latest = release[:tag].delete_prefix("v")
      if Gem::Version.new(latest) > Gem::Version.new(@version.delete_prefix("v"))
        return result("warning", "Version #{latest} is available (you have #{@version}).", latest: latest, url: release[:url])
      end

      result("ok", "You are running the latest version.", latest: latest, url: release[:url])
    rescue ArgumentError
      result("unknown", "Could not compare #{release[:tag]} with #{@version}.", url: release[:url])
    end

    def cached_release
      Rails.cache.read(CACHE_KEY) || fetch_release.tap do |release|
        Rails.cache.write(CACHE_KEY, release, expires_in: release[:error] ? 15.minutes : 12.hours)
      end
    end

    # { tag:, url: } for the latest release, { tag: nil } when there is none, or { error: } when GitHub did not answer.
    def fetch_release
      response = request
      case response.code.to_i
      when 200
        data = JSON.parse(response.body)
        { tag: data["tag_name"].to_s, url: data["html_url"].to_s }
      when 404 then { tag: nil }
      else { error: "GitHub answered #{response.code}" }
      end
    rescue StandardError => e
      { error: e.class.name.demodulize.underscore.tr("_", " ") }
    end

    def request
      http = Net::HTTP.new("api.github.com", 443)
      http.use_ssl = true
      http.open_timeout = http.read_timeout = TIMEOUT
      http.get("/repos/#{REPOSITORY}/releases/latest",
               "Accept" => "application/vnd.github+json", "User-Agent" => "FixFlow/#{@version} (update check)")
    end
  end
end
