require "rails_helper"

RSpec.describe FixflowConfigCheck::Live do
  let(:fine) { -> {} }
  let(:down) { -> { raise IOError, "connection refused\nsecond line" } }
  let(:reached) { [] }
  let(:tcp) { ->(host, port) { reached << [host, port] } }

  def live(env = {}, **probes)
    defaults = { database: fine, redis: fine, tcp: tcp }
    described_class.new(env: env, **defaults.merge(probes))
  end

  it "finds nothing when everything answers" do
    expect(live.problems).to eq([])
  end

  it "stops the start when the database or Redis does not answer, naming it and the reason" do
    problems = live({}, database: down, redis: down).problems
    expect(problems.map { |problem| [problem.level, problem.setting] }).to eq([[:error, "DATABASE_URL"], [:error, "REDIS_URL"]])
    expect(problems.first.message).to include("the database did not answer (IOError: connection refused)")
    expect(problems.first.message).not_to include("second line")
  end

  it "stops the start when the mail server set in the environment does not answer" do
    unreachable = ->(_host, _port) { raise Errno::ECONNREFUSED }
    problem = live({ "SMTP_HOST" => "smtp.acme.test", "SMTP_PORT" => "2525", "SMTP_PASSWORD" => "SG.real" },
tcp: unreachable).problems.first
    expect(problem).to have_attributes(level: :error, setting: "SMTP_HOST", message: include("smtp.acme.test:2525"))
  end

  it "asks the mail server on its port, 587 unless told otherwise" do
    live({ "SMTP_HOST" => "smtp.acme.test", "SMTP_PASSWORD" => "SG.real" }).problems
    live({ "SMTP_HOST" => "smtp2.acme.test", "SMTP_PORT" => "465", "SMTP_PASSWORD" => "SG.real" }).problems
    expect(reached).to eq([["smtp.acme.test", 587], ["smtp2.acme.test", 465]])
  end

  it "does not look for a mail server that is not set, or whose password is still the example" do
    live({ "SMTP_HOST" => "smtp.sendgrid.net", "SMTP_PASSWORD" => "your_sendgrid_api_key" }).problems
    live({}).problems
    expect(reached).to eq([])
  end

  it "only warns when the file storage or the IoT broker does not answer" do
    unreachable = ->(_host, _port) { raise Errno::ECONNREFUSED }
    env = { "MINIO_ENDPOINT" => "http://minio:9000", "MQTT_HOST" => "mqtt", "MQTT_PORT" => "1884" }
    problems = live(env, tcp: unreachable).problems
    expect(problems.map { |problem| [problem.level, problem.setting] }).to eq([[:warning, "MINIO_ENDPOINT"], [:warning, "MQTT_HOST"]])
    live(env).problems
    expect(reached).to eq([["minio", 9000], ["mqtt", 1884]])
  end

  it "ignores a storage address it cannot read (the static check reports that)" do
    expect(live({ "MINIO_ENDPOINT" => "not a url at all" }).problems).to eq([])
  end
end
