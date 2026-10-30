require "ipaddr"
require "resolv"

# Whether a chat webhook address is one this server may post to. An administrator types it, so it is trusted more than a
# push address a browser hands us (PushEndpoint) and an address inside the company network is fine: a self-hosted
# Mattermost or Rocket.Chat lives there. What is refused is the server itself and the places a server must not be sent to:
# its own loopback, link-local addresses (the cloud metadata service at 169.254.169.254 lives there) and "this host".
module ChatAddress
  MAX_LENGTH = 2048

  REFUSED = %w[0.0.0.0/8 127.0.0.0/8 169.254.0.0/16 224.0.0.0/4 240.0.0.0/4 ::/128 ::1/128 fe80::/10 ff00::/8 ::ffff:0:0/96]
            .map { |range| IPAddr.new(range) }.freeze

  # => nil when the address may be used, else the reason in words.
  def self.problem(url, resolver: Resolv)
    return "is missing" if url.blank?
    return "is too long" if url.length > MAX_LENGTH

    uri = URI.parse(url)
    unless uri.is_a?(URI::HTTP) && uri.host.present?
      return "must start with https:// (or http:// for a chat server on your own network)"
    end
    return "must not contain a login" if uri.userinfo

    addresses = literal?(uri.host) ? [uri.host] : resolver.getaddresses(uri.host)
    return "does not resolve to an address" if addresses.empty?
    return "points at this server or a link-local address, which is never a chat service" if addresses.any? { |address|
      refused?(address)
    }

    nil
  rescue URI::InvalidURIError, IPAddr::InvalidAddressError
    "is not a valid address"
  end

  def self.safe?(url, **) = problem(url, **).nil?

  def self.literal?(host)
    IPAddr.new(strip(host))
    true
  rescue IPAddr::InvalidAddressError
    false
  end

  def self.refused?(address)
    ip = IPAddr.new(strip(address.to_s))
    REFUSED.any? { |range| range.include?(ip) }
  end

  def self.strip(host) = host.delete_prefix("[").delete_suffix("]")
end
