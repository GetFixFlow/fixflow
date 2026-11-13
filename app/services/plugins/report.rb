require "timeout"

module Plugins
  # A report a plugin adds. The block is given a ReportContext and returns a table (see Plugins::Table):
  #
  #   { columns: [{ key: "name", label: "Name" }, { key: "hours", label: "Hours", kind: "number" }],
  #     rows: [{ "name" => "Pump 3", "hours" => 4.5 }],
  #     summary: [{ label: "Total hours", value: 4.5, kind: "number" }] }
  class Report < Data.define(:plugin_key, :key, :title, :description, :period, :block) # rubocop:disable Style/DataInheritance -- it has a constant
    # The most a report may take, in seconds. A report runs while a manager waits for it.
    TIME_LIMIT = 20

    def run(context)
      Table.build(Timeout.timeout(TIME_LIMIT) { block.call(context) })
    rescue Plugins::Error
      raise
    rescue Timeout::Error
      raise Error, "The report took longer than #{TIME_LIMIT} seconds, so it was stopped."
    rescue StandardError => e
      Rails.logger.error "[Plugins] #{plugin_key}/#{key} failed: #{e.class}: #{e.message}\n#{e.backtrace&.first(8)&.join("\n")}"
      raise Error, "The report could not be made: the plugin failed (#{e.class.name}). The server log has the details."
    end
  end

  # What a report is told: the company, the person asking, the period (the whole day at each end, in the company's time) and any
  # other values the screen sent. `from` and `to` are nil for a report that says period: false.
  ReportContext = Data.define(:organization, :user, :from, :to, :params)
end
