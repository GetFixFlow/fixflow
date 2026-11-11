require "net/ldap"

module Directory
  # Signing in with LDAP (Active Directory, OpenLDAP, FreeIPA...). A service account finds the person's entry from what
  # they typed (their email or username); then the person's own password is checked by binding as that entry. A blank
  # password is refused first: many servers treat a bind with a name and no password as an anonymous one that succeeds.
  class Ldap
    TIMEOUT = 8

    def initialize(settings)
      @settings = settings
    end

    # The person's identity when the password is right, nil when the person is not found, is not the only match, or the
    # password is wrong. Raises Directory::Error when the directory cannot be used (down, bad service account).
    def authenticate(login, password)
      login = login.to_s.strip
      return if login.empty? || password.to_s.empty?

      guarded do
        entry = find_user(login)
        identity_for(entry) if entry && bind(entry.dn, password)
      end
    end

    # What Settings' "Check" shows: the directory answers, the service account can search, and how many people it finds.
    def check
      guarded do
        connection = connect(service_auth)
        raise Error, "The service account could not sign in: #{explain(connection)}" unless connection.bind

        entries = connection.search(base: @settings.ldap_user_base, filter: user_filter_only, size: 50, attributes: ["dn"]) ||
                  raise(Error, "The search failed: #{explain(connection)}")
        { host: @settings.ldap_host, port: @settings.ldap_port, encryption: @settings.ldap_encryption, people_found: entries.size,
          more_than_listed: entries.size >= 50 }
      end
    end

    private

    # A directory that is down, a certificate that does not match, a filter that does not parse: all one kind of problem,
    # with the reason in words.
    def guarded(&)
      Timeout.timeout(TIMEOUT * 4, &) # the library has no timeout for a server that accepts and then says nothing
    rescue Net::LDAP::Error, SystemCallError, SocketError, Timeout::Error, OpenSSL::SSL::SSLError, IOError => e
      raise Error, "Could not use the directory at #{@settings.ldap_host}: #{e.message}"
    end

    def find_user(login)
      connection = connect(service_auth)
      raise Error, "The service account could not sign in: #{explain(connection)}" unless connection.bind

      escaped = Net::LDAP::Filter.escape(login)
      by_login = @settings.ldap_login_attribute_list.map { |attr| Net::LDAP::Filter.eq(attr, escaped.dup) }.reduce(:|)
      raise Error, "No login attributes are set" unless by_login

      filter = Net::LDAP::Filter.construct(user_filter_string) & by_login
      entries = connection.search(base: @settings.ldap_user_base, filter: filter, size: 2, attributes: attributes)
      raise Error, "The search failed: #{explain(connection)}" if entries.nil?

      entries.first if entries.size == 1 # two people matching the same login is no one's account
    end

    # Net::LDAP escapes for us when it builds a filter from a string with eq; the filter set in Settings is parsed once.
    def user_filter_string = @settings.ldap_user_filter.presence || "(objectClass=*)"
    def user_filter_only = Net::LDAP::Filter.construct(user_filter_string)

    def attributes
      [@settings.ldap_email_attribute, @settings.ldap_first_name_attribute, @settings.ldap_last_name_attribute,
       @settings.ldap_id_attribute, @settings.ldap_groups_attribute, *@settings.ldap_login_attribute_list, "dn"].compact_blank.uniq
    end

    def bind(user_dn, password)
      connection = connect(method: :simple, username: user_dn, password: password)
      connection.bind
    end

    def identity_for(entry)
      email = first(entry, @settings.ldap_email_attribute)
      if email.blank?
        raise Refused.new(:failed,
"The directory has no email address (#{@settings.ldap_email_attribute}) for #{entry.dn}")
      end

      Identity.new(provider: "ldap", subject: subject_for(entry), email: email,
                   first_name: first(entry, @settings.ldap_first_name_attribute),
                   last_name: first(entry, @settings.ldap_last_name_attribute),
                   groups: groups_for(entry), email_verified: true)
    end

    def subject_for(entry)
      raw = @settings.ldap_id_attribute.present? ? entry[@settings.ldap_id_attribute].first : nil
      return entry.dn.to_s.downcase if raw.nil?

      text = raw.to_s
      printable = text.dup.force_encoding("UTF-8").valid_encoding? && text.match?(/\A[[:print:]]+\z/)
      printable ? text : text.unpack1("H*") # Active Directory's objectGUID is 16 raw bytes
    end

    def first(entry, attribute)
      attribute.present? ? entry[attribute].first.to_s.strip.presence : nil
    end

    # From the person's own memberOf values; for a directory without them, the groups under the group base that list the
    # person as a member.
    def groups_for(entry)
      groups = @settings.ldap_groups_attribute.present? ? entry[@settings.ldap_groups_attribute].map(&:to_s) : []
      return groups if @settings.ldap_group_base.blank?

      connection = connect(service_auth)
      return groups unless connection.bind

      found = connection.search(base: @settings.ldap_group_base, size: 500, attributes: %w[cn dn],
                                filter: Net::LDAP::Filter.eq("member", Net::LDAP::Filter.escape(entry.dn.to_s)) |
                                        Net::LDAP::Filter.eq("uniqueMember", Net::LDAP::Filter.escape(entry.dn.to_s))) || []
      groups + found.map { |g| g.dn.to_s }
    end

    def service_auth
      if @settings.ldap_bind_dn.present?
        { method: :simple, username: @settings.ldap_bind_dn,
      password: @settings.ldap_bind_password.to_s }
      else
        { method: :anonymous }
      end
    end

    def connect(auth)
      Net::LDAP.new(host: @settings.ldap_host, port: @settings.ldap_port, auth: auth, encryption: encryption,
                    connect_timeout: TIMEOUT)
    end

    def encryption
      return if @settings.ldap_encryption == "none"

      tls = { verify_mode: @settings.ldap_verify_certificate ? OpenSSL::SSL::VERIFY_PEER : OpenSSL::SSL::VERIFY_NONE }
      tls[:cert_store] = cert_store if @settings.ldap_ca_certificate.present?
      { method: @settings.ldap_encryption == "ssl" ? :simple_tls : :start_tls, tls_options: tls }
    end

    # The company's own certificate authority, on top of the system's.
    def cert_store
      OpenSSL::X509::Store.new.tap do |store|
        store.set_default_paths
        @settings.ldap_ca_certificate.scan(/-----BEGIN CERTIFICATE-----.+?-----END CERTIFICATE-----/m).each do |pem|
          store.add_cert(OpenSSL::X509::Certificate.new(pem))
        end
      end
    end

    def explain(connection)
      result = connection.get_operation_result
      "#{result.message}#{" (#{result.error_message})" if result.error_message.present?}"
    end
  end
end
