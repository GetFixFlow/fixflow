require "ipaddr"
require "resolv"

# Whether an address is one a webhook may be sent to. An administrator types it, so an address inside the company network is
# fine (n8n on a server in the office is the usual receiver). What is refused is the server itself and the places a server
# must not be sent to: its own loopback, link-local addresses (the cloud metadata service at 169.254.169.254 lives there)
# and "this host". Checked when the webhook is saved and again before each delivery (a name can start pointing elsewhere).
module WebhookAddress
  MAX_LENGTH = 2048

  # => nil when the address may be used, else the reason in words.
  def self.problem(url, resolver: Resolv)
    return "is missing" if url.blank?
    return "is too long" if url.length > MAX_LENGTH

    uri = URI.parse(url)
    return "must start with https:// (or http:// for a receiver on your own network)" unless uri.is_a?(URI::HTTP) && uri.host.present?
    return "must not contain a login" if uri.userinfo

    addresses = addresses_for(uri.host, resolver)
    return "does not resolve to an address" if addresses.empty?
    return "points at this server or a link-local address" if addresses.any? { |address| ChatAddress.refused?(address) }

    nil
  rescue URI::InvalidURIError, IPAddr::InvalidAddressError
    "is not a valid address"
  end

  # The addresses the host name points at now (the delivery connects to one of these, so what was checked is what is used).
  def self.addresses_for(host, resolver = Resolv)
    ChatAddress.literal?(host) ? [ChatAddress.strip(host)] : resolver.getaddresses(host)
  end
end
