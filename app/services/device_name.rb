# "Chrome on macOS" from a browser's User-Agent text, for the list of where someone is signed in.
# Only the common cases; anything else is "Unknown device" rather than a guess.
module DeviceName
  BROWSERS = [
    [%r{Edg(e|A|iOS)?/}, "Edge"],
    [%r{OPR/|Opera}, "Opera"],
    [%r{Firefox/|FxiOS/}, "Firefox"],
    [%r{Chrome/|CriOS/}, "Chrome"],
    [%r{Safari/}, "Safari"]
  ].freeze

  SYSTEMS = [
    [/iPhone|iPad|iPod/, "iOS"],
    [/Android/, "Android"],
    [/Windows/, "Windows"],
    [/Mac OS X|Macintosh/, "macOS"],
    [/CrOS/, "ChromeOS"],
    [/Linux|X11/, "Linux"]
  ].freeze

  def self.for(user_agent)
    text = user_agent.to_s.scrub("")
    browser = BROWSERS.find { |pattern, _| text.match?(pattern) }&.last
    system = SYSTEMS.find { |pattern, _| text.match?(pattern) }&.last

    return "Unknown device" unless browser || system

    [browser || "Browser", system].compact.join(" on ")
  end
end
