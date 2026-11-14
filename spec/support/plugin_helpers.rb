require "tmpdir"

# Writes plugin folders for a spec and loads them: install_plugins("demo" => "Plugins.define('demo') { ... }").
module PluginHelpers
  # What the sample channel in GOOD_PLUGIN was given: [message, settings] for each delivery.
  def self.deliveries = (@deliveries ||= [])

  GOOD_PLUGIN = <<~RUBY.freeze
    Plugins.define "demo" do
      title "Demo"
      version "2.0.0"
      summary "A plugin for the specs."
      api 1
      report("things", title: "Things", description: "All the things") do |context|
        { columns: [{ key: "name", label: "Name" }, { key: "count", label: "Count", kind: "number" }],
          rows: [{ "name" => context.organization.name, "count" => 3 }] }
      end
      channel("echo", title: "Echo", fields: [{ key: "address", kind: "url", required: true }, { key: "token", kind: "secret" }]) do |message, settings|
        PluginHelpers.deliveries << [message, settings]
      end
    end
  RUBY

  def install_plugins(files)
    directory = Pathname.new(Dir.mktmpdir("plugins-spec")).tap { |path| (@plugin_directories ||= []) << path }
    files.each do |name, code|
      folder = directory.join(name)
      folder.mkpath
      folder.join("plugin.rb").write(code)
    end
    Plugins.load!(directory)
  end

  # Loads the sample plugins that ship with FixFlow, exactly as an administrator would after copying them.
  def install_sample_plugins(*names)
    directory = Pathname.new(Dir.mktmpdir("plugins-spec")).tap { |path| (@plugin_directories ||= []) << path }
    names.each { |name| FileUtils.cp_r(Rails.root.join("examples/plugins", name), directory.join(name)) }
    Plugins.load!(directory)
  end

  def remove_plugin_directories
    Array(@plugin_directories).each { |path| FileUtils.remove_entry(path) if path.exist? }
  end
end

RSpec.configure do |config|
  config.include PluginHelpers
  config.before do
    Plugins.reset!
    PluginHelpers.deliveries.clear
  end
  config.after do
    Plugins.reset!
    remove_plugin_directories
  end
end
