require "rails_helper"
require "sidekiq/scheduled"

# Sidekiq 7.3 waits on a ConnectionPool::TimedStack with pop(timeout). connection_pool 3 changed that call, which kills
# the thread that moves retries and delayed jobs onto their queues: nothing delayed (a retry, `wait:`) ever runs again.
# The Gemfile keeps connection_pool below 3 for this reason; this fails if that is undone before Sidekiq is upgraded.
RSpec.describe Sidekiq::Scheduled::Poller do
  it "can wait the way it does when it starts" do
    sleeper = described_class.new(Sidekiq.default_configuration).instance_variable_get(:@sleeper)

    expect { sleeper.pop(0.01) }.to raise_error(Timeout::Error)
  end
end
