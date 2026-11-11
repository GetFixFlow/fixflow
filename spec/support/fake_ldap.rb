# A directory in memory standing in for an LDAP server: it keeps the filters it was asked, answers searches from a list of
# people, and accepts a bind only with the right password.
module FakeLdap
  Entry = Struct.new(:dn, :attrs) do
    # Net::LDAP::Entry answers [] for an attribute the person does not have
    def [](name) = Array(attrs[name.to_s])
  end

  class Server
    attr_reader :searches, :binds, :built, :people, :passwords

    def initialize(people:, passwords:, groups: [])
      @people = people
      @passwords = passwords
      @groups = groups
      @searches = []
      @binds = []
      @built = []
    end

    def build(args)
      @built << args
      Connection.new(self, args[:auth])
    end

    def groups_for(_filter) = @groups

    class Connection
      def initialize(server, auth)
        @server = server
        @auth = auth
      end

      # rubocop:disable Naming/PredicateMethod -- these are Net::LDAP's own method names
      def bind
        @server.binds << @auth
        return true if @auth[:method] == :anonymous

        @server.passwords[@auth[:username]] == @auth[:password] && @auth[:password].present?
      end
      # rubocop:enable Naming/PredicateMethod

      def get_operation_result = Struct.new(:message, :error_message).new("Invalid Credentials", "") # rubocop:disable Naming/AccessorMethodName

      def search(base:, filter:, **)
        @server.searches << { base: base, filter: filter.to_s }
        return @server.groups_for(filter.to_s) if base.start_with?("ou=groups")
        return @server.people unless filter.to_s.include?("mail=") # a search for everyone, as Check does

        @server.people.select { |p|
          filter.to_s.include?("=#{p.attrs['uid'].first})") || filter.to_s.include?("=#{p.attrs['mail'].first})")
        }
      end
    end
  end
end
