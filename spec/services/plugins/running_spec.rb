require "rails_helper"

# What happens when a plugin's own code runs: a report is made, a channel delivers. A plugin that misbehaves must produce a
# sentence for the person looking, never an error page, and never stop anything else.
RSpec.describe "Running a plugin's code" do # rubocop:disable RSpec/DescribeClass
  let(:org) { create(:organization) }
  let(:context) { Plugins::ReportContext.new(organization: org, user: nil, from: nil, to: nil, params: {}) }

  def plugin_with(report: nil, channel: nil)
    code = +%(Plugins.define("run") { title "Run"; api 1\n)
    code << %(report("rep", title: "Rep") { |context| #{report} }\n) if report
    code << %(channel("chan", title: "Chan") { |message, settings| #{channel} }\n) if channel
    code << "}"
    install_plugins("run" => code)
    Plugins.find("run")
  end

  describe "a report" do
    it "answers with a checked table" do
      report = plugin_with(report: '{ columns: [{ key: "a" }], rows: [{ "a" => context.organization.name }] }').find_report("rep")

      expect(report.run(context).rows).to eq([[org.name]])
    end

    it "says what is wrong with a table that is the wrong shape" do
      report = plugin_with(report: "{ columns: [] }").find_report("rep")

      expect { report.run(context) }.to raise_error(Plugins::Error, "The report has no columns.")
    end

    it "turns a crash inside the plugin into a sentence that names the kind of failure, and logs the rest" do
      report = plugin_with(report: "1 / 0").find_report("rep")
      allow(Rails.logger).to receive(:error)

      expect { report.run(context) }.to raise_error(
        Plugins::Error, "The report could not be made: the plugin failed (ZeroDivisionError). The server log has the details."
      )
      expect(Rails.logger).to have_received(:error).with(%r{run/rep failed: ZeroDivisionError}) # rubocop:disable RSpec/MessageSpies
    end

    it "does not show the plugin's error text, which may hold a secret or a record" do
      report = plugin_with(report: 'raise "password is hunter2"').find_report("rep")

      expect { report.run(context) }.to raise_error(Plugins::Error) { |error| expect(error.message).not_to include("hunter2") }
    end

    it "stops a report that takes too long" do
      report = plugin_with(report: "sleep 5").find_report("rep")
      stub_const("Plugins::Report::TIME_LIMIT", 0.05)

      expect { report.run(context) }.to raise_error(Plugins::Error, /took longer than 0.05 seconds/)
    end

    it "is given the company, the person and the period it was asked for" do
      code = '{ columns: [{ key: "a" }], rows: [[[context.organization.id, context.params[:x]].join(",")]] }'
      report = plugin_with(report: code).find_report("rep")
      ask = Plugins::ReportContext.new(organization: org, user: nil, from: Time.zone.now, to: Time.zone.now, params: { x: "7" })

      expect(report.run(ask).rows).to eq([["#{org.id},7"]])
    end
  end

  describe "a channel" do
    let(:message) { Plugins::Message.new(event: "wo_assigned", title: "T", body: "B", link: nil, company: org.name) }

    it "is given the message and its settings" do
      channel = plugin_with(channel: "PluginHelpers.deliveries << [message.title, settings[:x]]").find_channel("chan")

      expect(channel.deliver(message, { x: 1 })).to be(true)
      expect(PluginHelpers.deliveries).to eq([["T", 1]])
    end

    it "passes on Refused and Unavailable as they are" do
      expect {
        plugin_with(channel: 'raise Plugins::Refused, "no"').find_channel("chan").deliver(message, {})
      }.to raise_error(Plugins::Refused, "no")
      expect {
        plugin_with(channel: 'raise Plugins::Unavailable, "later"').find_channel("chan").deliver(message,
       {})
      }.to raise_error(Plugins::Unavailable, "later")
    end

    it "counts a network failure inside the plugin as 'try again later'" do
      [Net::OpenTimeout, Errno::ECONNREFUSED, SocketError].each do |error|
        channel = plugin_with(channel: "raise #{error}").find_channel("chan")

        expect {
          channel.deliver(message, {})
        }.to raise_error(Plugins::Unavailable, /could not be reached \(#{error.name.demodulize}\)/)
      end
    end

    it "counts any other crash as the plugin's own fault, which is not tried again" do
      channel = plugin_with(channel: 'raise "boom"').find_channel("chan")
      allow(Rails.logger).to receive(:error)

      expect {
        channel.deliver(message, {})
      }.to raise_error(Plugins::Refused, "The plugin failed (RuntimeError). The server log has the details.")
    end

    it "stops a channel that does not answer" do
      channel = plugin_with(channel: "sleep 5").find_channel("chan")
      stub_const("Plugins::Channel::TIME_LIMIT", 0.05)

      expect { channel.deliver(message, {}) }.to raise_error(Plugins::Unavailable, /did not answer within 0.05 seconds/)
    end
  end
end
