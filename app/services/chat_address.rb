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

  # The verdict on an address and, when it may be used, the one address the name was resolved to. A sender connects to
  # THAT address: looking the name up again to connect would let a name that answers differently the second time (DNS
  # rebinding) reach the places refused here.
  Checked = Struct.new(:problem, :ip)

  # => nil when the address may be used, else the reason in words.
  def self.problem(url, resolver: Resolv) = check(url, resolver: resolver).problem

  def self.check(url, resolver: Resolv)
    return Checked.new("is missing") if url.blank?
    return Checked.new("is too long") if url.length > MAX_LENGTH

    uri = URI.parse(url)
    unless uri.is_a?(URI::HTTP) && uri.host.present?
      return Checked.new("must start with https:// (or http:// for a chat server on your own network)")
    end
    return Checked.new("must not contain a login") if uri.userinfo

    addresses = literal?(uri.host) ? [strip(uri.host)] : resolver.getaddresses(uri.host)
    return Checked.new("does not resolve to an address") if addresses.empty?
    if addresses.any? { |address| refused?(address) }
      return Checked.new("points at this server or a link-local address, which is never a chat service")
    end

    Checked.new(nil, addresses.first)
  rescue URI::InvalidURIError, IPAddr::InvalidAddressError
    Checked.new("is not a valid address")
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
