require "rails_helper"
require "rake"

RSpec.describe "fixflow:plugins", type: :task do
  # Loaded once for the whole run: loading twice makes every task do its work twice.
  before(:all) { Rails.application.load_tasks unless Rake::Task.task_defined?("fixflow:create_admin") } # rubocop:disable RSpec/BeforeAfterAll

  let(:task) { Rake::Task["fixflow:plugins"] }

  # What the task printed, and the status it exited with (nil when it finished normally).
  def run_task
    original = $stdout
    $stdout = StringIO.new
    status = nil
    begin
      task.reenable
      task.invoke
    rescue SystemExit => e
      status = e.status
    end
    [$stdout.string, status]
  ensure
    $stdout = original
  end

  def use_folder(files)
    directory = Pathname.new(Dir.mktmpdir("plugins-spec")).tap { |path| (@plugin_directories ||= []) << path }
    files.each do |name, code|
      directory.join(name).mkpath
      directory.join(name, "plugin.rb").write(code)
    end
    stub_const("ENV", ENV.to_h.merge("PLUGINS_DIR" => directory.to_s))
  end

  it "says when nothing is installed" do
    use_folder({})

    out, status = run_task

    expect(out).to include("No plugins installed.")
    expect(status).to be_nil
  end

  it "lists what each plugin adds" do
    use_folder("demo" => PluginHelpers::GOOD_PLUGIN)

    out, status = run_task

    expect(out).to include("demo: Demo 2.0.0", "report   things — Things", "channel  echo — Echo (address, token)")
    expect(status).to be_nil
  end

  it "says why a plugin did not load, and exits with 1 so a script can tell" do
    use_folder("demo" => PluginHelpers::GOOD_PLUGIN, "broken" => "raise 'boom'")

    out, status = run_task

    expect(out).to include("demo: Demo", "Did not load:", "broken: RuntimeError: boom")
    expect(status).to eq(1)
  end
end
