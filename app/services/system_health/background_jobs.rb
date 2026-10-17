require "sidekiq/api"

class SystemHealth
  # Whether the background worker (Sidekiq) is running and keeping up. Without it emails, scheduled PM work orders,
  # IoT alerts and the nightly jobs silently stop, which is the failure an administrator most needs to hear about.
  class BackgroundJobs
    LATENCY_WARNING = 300 # seconds a job may wait before someone should look
    NO_WORKER = "No background worker is running, so emails, scheduled PM work orders, IoT alerts and the nightly jobs " \
                "are not happening. Start Sidekiq (`bundle exec sidekiq`, or the sidekiq service in Docker).".freeze
    UNKNOWN_FACTS = { workers: nil, busy: nil, queued: nil, scheduled: nil, retrying: nil, dead: nil, latency_seconds: nil }.freeze

    def call
      facts = facts_now
      return verdict("error", NO_WORKER, facts) if facts[:workers].zero?
      return verdict("warning", waiting_message(facts), facts) if facts[:latency_seconds] > LATENCY_WARNING
      return verdict("warning", failed_message(facts), facts) if facts[:dead].positive?

      verdict("ok", "The background worker is running.", facts)
    rescue StandardError => e
      detail = "#{e.class.name.demodulize}: #{e.message.to_s.lines.first.to_s.strip}"
      verdict("error", "Could not read the job queue (#{detail}).", UNKNOWN_FACTS)
    end

    private

    def verdict(status, message, facts) = { status: status, message: message, **facts }

    def failed_message(facts) = "#{facts[:dead]} background job(s) failed for good. See the Sidekiq dead set."

    def waiting_message(facts)
      "Jobs have been waiting #{(facts[:latency_seconds] / 60.0).ceil} minutes: the worker may be stuck or too busy."
    end

    def facts_now
      processes = Sidekiq::ProcessSet.new
      stats = Sidekiq::Stats.new
      {
        workers: processes.size, busy: processes.sum { |process| process["busy"].to_i }, queued: stats.enqueued,
        scheduled: stats.scheduled_size, retrying: stats.retry_size, dead: stats.dead_size,
        latency_seconds: Sidekiq::Queue.all.map(&:latency).max.to_f.round
      }
    end
  end
end
