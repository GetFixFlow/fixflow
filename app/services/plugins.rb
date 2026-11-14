# Plugins: code a company (or a volunteer) adds to FixFlow without changing FixFlow itself.
#
# A plugin is a folder in the plugins folder (PLUGINS_DIR, default `plugins/`) with a `plugin.rb` in it. Starting the server
# loads every one of them. A plugin can add two kinds of thing (the "extension points"):
#
#   * a REPORT: a table the managers open under Reports, with a CSV download;
#   * a NOTIFICATION CHANNEL: somewhere FixFlow tells people about the events it already announces (a work order assigned, a
#     sensor alert...), set up by an administrator under Settings, Plugins.
#
# Plugins are trusted code: they run inside the server with the server's rights, so only install what you have read. What is
# guarded is the rest of the system: a plugin that does not load, or fails while it runs, is reported on the Plugins screen and
# never stops FixFlow or the other plugins. docs/plugins.md is the guide for people who write them.
#
#   Plugins.define "overdue_work" do
#     title "Overdue work"
#     version "1.0.0"
#     api 1
#     report("by_person", title: "Overdue work by person") { |context| { columns: [...], rows: [...] } }
#   end
module Plugins
  # Which shape of this file's contract a plugin was written for. A plugin states it (`api 1`) and is refused, with a reason,
  # by a FixFlow that offers another one, rather than failing in strange ways later.
  API_VERSION = 1
  KEY_FORMAT = /\A[a-z][a-z0-9_]{1,39}\z/

  # What went wrong, in words an administrator can act on.
  class Error < StandardError; end
  # A channel could not deliver, and trying again will not help (a wrong address, a revoked token).
  class Refused < Error; end
  # A channel could not deliver now: the service or the network is having a moment. The message is sent again, a few times.
  class Unavailable < Error; end

  # A plugin folder that did not load: where, and why.
  Failure = Struct.new(:folder, :message, keyword_init: true)

  @installed = {}
  @failures = []
  @source = nil
  @lock = Mutex.new

  class << self
    attr_reader :failures

    def directory
      Pathname.new(ENV["PLUGINS_DIR"].presence || Rails.root.join("plugins"))
    end

    # Every plugin that loaded, in the order of their folder names.
    def installed = @installed.values

    def find(key) = @installed[key.to_s]

    def report(plugin_key, report_key) = find(plugin_key)&.find_report(report_key)

    def channel(plugin_key, channel_key) = find(plugin_key)&.find_channel(channel_key)

    # Reads every plugin folder. Run when the server starts (config/initializers/plugins.rb) and again, in development, when
    # code is reloaded. A folder that fails is left out and listed in `failures`; nothing else is affected.
    def load!(folder = directory)
      @lock.synchronize do
        @installed = {}
        @failures = []
        plugin_folders(Pathname.new(folder)).each { |path| load_folder(path) }
      end
      installed
    end

    # Adds a plugin. Called by plugin.rb; the block describes it (see Plugins::Definition).
    def define(key, &)
      definition = Definition.build(key, source: @source, &)
      raise Error, "another plugin is already called #{definition.key}" if @installed.key?(definition.key)

      @installed[definition.key] = definition
    end

    # For specs: forget everything that was loaded.
    def reset!
      @lock.synchronize do
        @installed = {}
        @failures = []
      end
    end

    private

    def plugin_folders(root)
      return [] unless root.directory?

      root.children.select { |path| path.directory? && !path.basename.to_s.start_with?(".") }.sort_by { |path| path.basename.to_s }
    end

    def load_folder(path)
      file = path.join("plugin.rb")
      return failed(path, "there is no plugin.rb in it") unless file.file?

      before = @installed.keys
      @source = path.basename.to_s
      begin
        Kernel.load(file.to_s)
      rescue Exception => e # rubocop:disable Lint/RescueException -- a plugin with a syntax error raises ScriptError, which must not stop the server
        raise if e.is_a?(SystemExit) || e.is_a?(NoMemoryError) || e.is_a?(Interrupt)

        (@installed.keys - before).each { |key| @installed.delete(key) }
        failed(path, "#{e.class.name}: #{e.message}".truncate(400))
        Rails.logger.error "[Plugins] #{path.basename} did not load: #{e.class}: #{e.message}"
      ensure
        @source = nil
      end
      return unless (@installed.keys - before).empty? && @failures.none? { |failure| failure.folder == path.basename.to_s }

      failed(path, "plugin.rb did not define a plugin (it must call Plugins.define)")
    end

    def failed(path, message)
      @failures << Failure.new(folder: path.basename.to_s, message: message)
    end
  end
end
