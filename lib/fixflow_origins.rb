# The web addresses a browser may open FixFlow from: APP_URL, and anything listed in ALLOWED_ORIGINS.
#
# Action Cable (live updates) only accepts a WebSocket from the address it was reached on, and with assume_ssl on
# (production.rb) it takes that address to be https:// whatever the browser used. So an install served over plain
# http:// would be refused for ever; listing the addresses here lets it connect. Browsers send no trailing slash.
module FixflowOrigins
  def self.from_env(env = ENV)
    [env["APP_URL"], *env.fetch("ALLOWED_ORIGINS", "").split(",")].map { |origin| origin.to_s.strip.chomp("/") }.reject(&:empty?).uniq
  end
end
