require "ipaddr"
require "resolv"

# Whether an address is one an AI provider may be reached at. What the administrator chose decides:
#
#   openai_compatible  a service on the internet (OpenAI, OpenRouter, Groq...). It must be https, and it must NOT be on a private
#                      network: a model on your own network is the "local" choice, and that is the one that promises the data
#                      stays there.
#   local              a model run by the company on its own network (Ollama, LM Studio, vLLM, llama.cpp...). It must be on this
#                      server or a private network, so that no data leaves. http is fine there.
#
# Neither may be a link-local address (the cloud metadata service at 169.254.169.254 lives there), "this host" or a multicast
# address. It is checked when the setting is saved and again before each call (a name can start pointing somewhere else), and the
# connection goes to the address that was checked.
module AiAddress
  MAX_LENGTH = 2048
  class Refused < StandardError; end

  NEVER = %w[0.0.0.0/8 169.254.0.0/16 224.0.0.0/4 240.0.0.0/4 ::/128 fe80::/10 ff00::/8].map { |range| IPAddr.new(range) }.freeze
  # This server, and the networks a company keeps its own machines on (100.64.0.0/10 is what Tailscale and carrier NAT use).
  PRIVATE = %w[127.0.0.0/8 10.0.0.0/8 172.16.0.0/12 192.168.0.0/16 100.64.0.0/10 ::1/128 fc00::/7]
            .map { |range| IPAddr.new(range) }.freeze

  NEVER_REASON = "points at a link-local, multicast or \"this host\" address, which is never an AI service".freeze
  LOCAL_REASON = "is not on this server or a private network, so the data would leave it. " \
                 "Use the OpenAI-compatible choice for a service on the internet.".freeze
  PRIVATE_REASON = "is on a private network. Use the Local model choice for a model you run yourself: " \
                   "that is the one that keeps the data there.".freeze

  # => nil when the address may be used for that kind of provider, else the reason in words.
  # resolve: false skips looking a name up (so it is cheap enough to ask on every page); an address written as numbers is
  # still judged in full. The call itself always looks the name up (see .checked_addresses).
  def self.problem(kind, url, resolver: Resolv, resolve: true)
    return "is missing" if url.blank?
    return "is too long" if url.length > MAX_LENGTH

    uri = URI.parse(url)
    return "is not a valid address" unless uri.is_a?(URI::HTTP) && uri.host.present?
    return "must not contain a login" if uri.userinfo
    return "must not have a ? or # part" if uri.query || uri.fragment
    return "must start with https://" if kind == "openai_compatible" && uri.scheme != "https"

    return nil unless resolve || literal?(uri.host)

    addresses = addresses_for(uri.host, resolver)
    return "does not resolve to an address" if addresses.empty?

    where_problem(kind, addresses)
  rescue URI::InvalidURIError, IPAddr::InvalidAddressError
    "is not a valid address"
  end

  # The addresses to connect to, all of them checked now, in the order to try them (a name such as localhost can have an IPv6 and
  # an IPv4 address, and a program often listens on only one). Raises AiAddress::Refused with the reason when any may not be used.
  def self.checked_addresses(kind, uri, resolver: Resolv)
    addresses = addresses_for(uri.host, resolver)
    reason = addresses.empty? ? "does not resolve to an address" : where_problem(kind, addresses)
    raise Refused, "The address #{reason}." if reason

    addresses
  end

  def self.where_problem(kind, addresses)
    ips = addresses.map { |address| ip(address) }
    return NEVER_REASON if ips.any? { |ip| within?(NEVER, ip) }

    private_count = ips.count { |ip| within?(PRIVATE, ip) }
    if kind == "local"
      private_count == ips.size ? nil : LOCAL_REASON
    elsif private_count.positive?
      PRIVATE_REASON
    end
  end

  def self.within?(ranges, ip) = ranges.any? { |range| range.include?(ip) }

  def self.addresses_for(host, resolver = Resolv)
    literal?(host) ? [strip(host)] : resolver.getaddresses(host)
  end

  def self.literal?(host)
    IPAddr.new(strip(host))
    true
  rescue IPAddr::InvalidAddressError
    false
  end

  def self.ip(address)
    parsed = IPAddr.new(strip(address.to_s))
    parsed.ipv4_mapped? ? parsed.native : parsed
  end

  def self.strip(host) = host.delete_prefix("[").delete_suffix("]")

  private_class_method :where_problem, :within?, :ip
end
