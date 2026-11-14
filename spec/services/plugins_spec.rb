require "rails_helper"

RSpec.describe Plugins do
  def failure_for(folder) = described_class.failures.find { |failure| failure.folder == folder }

  describe ".load!" do
    it "loads each plugin folder and says what it adds" do
      install_plugins("demo" => PluginHelpers::GOOD_PLUGIN)

      plugin = described_class.find("demo")
      expect(plugin).to have_attributes(title: "Demo", version: "2.0.0", summary: "A plugin for the specs.", source: "demo")
      expect(plugin.reports.map(&:key)).to eq(["things"])
      expect(plugin.channels.map(&:key)).to eq(["echo"])
      expect(described_class.failures).to be_empty
    end

    it "finds a report or a channel by the plugin's name and its own" do
      install_plugins("demo" => PluginHelpers::GOOD_PLUGIN)

      expect(described_class.report("demo", "things").title).to eq("Things")
      expect(described_class.channel("demo", "echo").title).to eq("Echo")
      expect(described_class.report("demo", "nope")).to be_nil
      expect(described_class.report("nope", "things")).to be_nil
      expect(described_class.channel("demo", "things")).to be_nil
    end

    it "reads the folders in the order of their names" do
      install_plugins("zeta" => PluginHelpers::GOOD_PLUGIN.sub('"demo"', '"zeta"'),
"alpha" => PluginHelpers::GOOD_PLUGIN.sub('"demo"', '"alpha"'))

      expect(described_class.installed.map(&:key)).to eq(%w[alpha zeta])
    end

    it "does nothing, quietly, when there is no plugins folder" do
      expect(described_class.load!(Rails.root.join("tmp/no-such-plugins-folder"))).to eq([])
      expect(described_class.failures).to be_empty
    end

    it "ignores hidden folders and loose files" do
      directory = Pathname.new(Dir.mktmpdir("plugins-spec"))
      (@plugin_directories ||= []) << directory
      directory.join(".git").mkpath
      directory.join("notes.txt").write("hello")

      expect(described_class.load!(directory)).to eq([])
      expect(described_class.failures).to be_empty
    end

    it "starts afresh each time (a plugin taken away is gone)" do
      install_plugins("demo" => PluginHelpers::GOOD_PLUGIN)
      install_plugins("other" => PluginHelpers::GOOD_PLUGIN.sub('"demo"', '"other"'))

      expect(described_class.installed.map(&:key)).to eq(["other"])
    end

    it "reads the folder named by PLUGINS_DIR" do
      directory = Pathname.new(Dir.mktmpdir("plugins-spec"))
      (@plugin_directories ||= []) << directory
      stub_const("ENV", ENV.to_h.merge("PLUGINS_DIR" => directory.to_s))

      expect(described_class.directory).to eq(directory)
    end
  end

  describe "a plugin that cannot be loaded" do
    it "is left out and explained, and the others still load" do
      install_plugins("a_broken" => "def (", "demo" => PluginHelpers::GOOD_PLUGIN, "z_raises" => 'raise "boom"')

      expect(described_class.installed.map(&:key)).to eq(["demo"])
      expect(failure_for("a_broken").message).to match(/SyntaxError/)
      expect(failure_for("z_raises").message).to eq("RuntimeError: boom")
    end

    it "has no half-registered plugin left behind when its file fails after defining one" do
      install_plugins("half" => "#{PluginHelpers::GOOD_PLUGIN}\nraise 'too late'")

      expect(described_class.installed).to be_empty
      expect(failure_for("half").message).to include("too late")
    end

    it "is explained when the folder has no plugin.rb" do
      directory = Pathname.new(Dir.mktmpdir("plugins-spec"))
      (@plugin_directories ||= []) << directory
      directory.join("empty").mkpath
      described_class.load!(directory)

      expect(failure_for("empty").message).to eq("there is no plugin.rb in it")
    end

    it "is explained when plugin.rb defines nothing" do
      install_plugins("silent" => "# nothing here")

      expect(failure_for("silent").message).to include("did not define a plugin")
    end

    it "is refused, with the reason, when written for another plugin API" do
      install_plugins("old" => PluginHelpers::GOOD_PLUGIN.sub("api 1", "api 7"))

      expect(failure_for("old").message).to eq("Plugins::Error: it was written for plugin API 7, and this FixFlow offers 1")
    end

    it "is refused when it does not say which API it was written for" do
      install_plugins("vague" => PluginHelpers::GOOD_PLUGIN.sub("  api 1\n", ""))

      expect(failure_for("vague").message).to include("plugin API nil")
    end

    it "is refused when it adds neither a report nor a channel" do
      install_plugins("empty" => %(Plugins.define("empty") { title "Empty"; api 1 }))

      expect(failure_for("empty").message).to include("adds no report and no channel")
    end

    it "is refused when its name is not a plain lower-case word" do
      install_plugins("odd" => PluginHelpers::GOOD_PLUGIN.sub('"demo"', '"Demo Plugin"'))

      expect(failure_for("odd").message).to include("must be lower-case letters")
    end

    it "is refused when another plugin already has its name" do
      install_plugins("one" => PluginHelpers::GOOD_PLUGIN, "two" => PluginHelpers::GOOD_PLUGIN)

      expect(described_class.find("demo").source).to eq("one")
      expect(failure_for("two").message).to include("already called demo")
    end

    it "is refused when it has no title" do
      install_plugins("untitled" => PluginHelpers::GOOD_PLUGIN.sub('  title "Demo"', ""))

      expect(failure_for("untitled").message).to include("no title")
    end

    it "is refused when a report has no block to run, or a channel none to deliver with" do
      install_plugins(
        "no_report_block" => %(Plugins.define("a") { title "A"; api 1; report("r", title: "R") }),
        "no_channel_block" => %(Plugins.define("b") { title "B"; api 1; channel("c", title: "C") })
      )

      expect(failure_for("no_report_block").message).to include("has no block to run")
      expect(failure_for("no_channel_block").message).to include("has no block to deliver with")
    end

    it "is refused when two of its reports share a name" do
      code = %(Plugins.define("tt") { title "T"; api 1; report("rr", title: "R") { {} }; report("rr", title: "R2") { {} } })
      install_plugins("twice" => code)

      expect(failure_for("twice").message).to include('"rr" is used twice')
    end

    it "is refused when a report is named in capitals" do
      install_plugins("caps" => PluginHelpers::GOOD_PLUGIN.sub('report("things"', 'report("Things"'))

      expect(failure_for("caps").message).to include("report name")
    end

    it "is refused when a channel field is of an unknown kind, a select has no options, or a field is named twice" do
      install_plugins(
        "kind" => PluginHelpers::GOOD_PLUGIN.sub('kind: "url"', 'kind: "password"'),
        "select" => PluginHelpers::GOOD_PLUGIN.sub('kind: "url"', 'kind: "select"'),
        "twice" => PluginHelpers::GOOD_PLUGIN.sub('{ key: "token", kind: "secret" }', '{ key: "address" }')
      )

      expect(failure_for("kind").message).to include("unknown kind")
      expect(failure_for("select").message).to include("needs options")
      expect(failure_for("twice").message).to include("used twice")
    end
  end
end
