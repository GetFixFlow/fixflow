require "ipaddr"
require "resolv"

# Whether an address a browser gave us as "where to push to" is safe for this server to post to. The address is the
# browser vendor's push service (fcm.googleapis.com, updates.push.services.mozilla.com, *.push.apple.com, ...), but it is
# written by whoever signs in, so a hostile one could name something inside the network (a cloud metadata service, the
# database, an admin page) and have this server call it. Only https, and only to addresses on the public internet.
module PushEndpoint
  MAX_LENGTH = 2048

  PRIVATE_RANGES = %w[
    0.0.0.0/8 10.0.0.0/8 100.64.0.0/10 127.0.0.0/8 169.254.0.0/16 172.16.0.0/12 192.0.0.0/24 192.168.0.0/16
    198.18.0.0/15 224.0.0.0/4 240.0.0.0/4 ::/128 ::1/128 fc00::/7 fe80::/10 ff00::/8 ::ffff:0:0/96
  ].map { |range| IPAddr.new(range) }.freeze

  # => nil when the address may be used, else the reason, in words for the person (and the log).
  def self.problem(endpoint, resolver: Resolv)
    return "is missing" if endpoint.blank?
    return "is too long" if endpoint.length > MAX_LENGTH

    uri = URI.parse(endpoint)
    return "must be an https address" unless uri.is_a?(URI::HTTPS) && uri.host.present?
    return "must not contain a login" if uri.userinfo

    addresses = literal?(uri.host) ? [uri.host] : resolver.getaddresses(uri.host)
    return "does not resolve to an address" if addresses.empty?
    return "points inside a network, not at a push service" if addresses.any? { |address| private?(address) }

    nil
  rescue URI::InvalidURIError, IPAddr::InvalidAddressError
    "is not a valid address"
  end

  def self.safe?(endpoint, **) = problem(endpoint, **).nil?

  def self.literal?(host)
    IPAddr.new(host.delete_prefix("[").delete_suffix("]"))
    true
  rescue IPAddr::InvalidAddressError
    false
  end

  def self.private?(address)
    ip = IPAddr.new(address.to_s.delete_prefix("[").delete_suffix("]"))
    PRIVATE_RANGES.any? { |range| range.include?(ip) }
  end
end
