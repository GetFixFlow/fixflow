module Forecast
  # What each part is likely to be used over the next 30 days, from how much was used in the last six, and whether what is in
  # stock (and on order) will cover it. It is statistics on this server: nothing is sent to an AI provider.
  #
  # Use is counted in 30-day periods ending now, from the parts logged on work orders. The expectation is a weighted average of
  # them (the latest period counts most), and the range is what an ordinary swing from period to period allows (an 80% range: the
  # average plus and minus 1.28 standard deviations, never less than the swing a purely random use would have). It says nothing
  # about a part until it is worth saying something:
  #
  # - the company's parts have been logged for at least three periods, 90 days (otherwise there is no history to go by, for any part);
  # - the part was used at least three times in the last six periods.
  #
  # Parts that are used only for planned work are only seen through the work orders they were logged on: a preventive
  # maintenance schedule does not say which parts it will need, so a job that is due next month and needs a part nobody has used
  # lately is not in these numbers.
  class PartsDemand
    PERIOD   = 30.days
    PERIODS  = 6
    MIN_USES = 3
    DECAY    = 0.8   # each older period counts this much of the one after it
    Z80      = 1.2816 # the 80% range of a normal swing

    Row = Struct.new(:part, :used, :expected, :low, :high, :on_hand, :on_order, :status, :days_of_stock, :suggested_quantity,
                     :periods, :uses, keyword_init: true)

    # => rows for the parts worth saying something about, those that may run short first.
    def self.for(organization, now: Time.current)
      new(organization, now).rows
    end

    def initialize(organization, now)
      @organization = organization
      @now = now
    end

    def rows
      periods = history_periods
      return [] if periods < 3

      sorted(usage(periods).filter_map { |part_id, quantities, uses| row_for(part_id, quantities, uses) })
    end

    private

    # How many whole 30-day periods the company's part logs go back, up to six.
    def history_periods
      first = WorkOrderPart.joins(:part).where(parts: { organization_id: @organization.id }).minimum(:created_at)
      return 0 unless first

      [((@now - first) / PERIOD).floor, PERIODS].min
    end

    # [part id, what was used in the latest period, the one before, ..., how many times it was logged], for each part used enough.
    def usage(periods)
      from = @now - (PERIOD * periods)
      logged = WorkOrderPart.joins(:part).where(parts: { organization_id: @organization.id }).where(created_at: from..@now)
                            .pluck(:part_id, :quantity_used, :created_at)
      logged.group_by(&:first).filter_map do |part_id, entries|
        next if entries.size < MIN_USES

        quantities = Array.new(periods, 0)
        entries.each { |(_, quantity, at)| quantities[((@now - at) / PERIOD).floor.clamp(0, periods - 1)] += quantity }
        [part_id, quantities, entries.size]
      end
    end

    def row_for(part_id, quantities, uses)
      part = parts[part_id]
      return unless part

      expected = weighted_mean(quantities)
      spread = [standard_deviation(quantities), Math.sqrt(expected)].max * Z80
      on_hand = part.quantity_on_hand.to_f
      on_order = ordered.fetch(part_id, 0.0)
      available = on_hand + on_order
      high = expected + spread

      Row.new(part: part, used: quantities.first, expected: expected, low: [expected - spread, 0.0].max, high: high, on_hand: on_hand,
              on_order: on_order, status: status(available, expected, high), uses: uses, periods: quantities.size,
              days_of_stock: expected.positive? ? (on_hand / (expected / 30.0)) : nil,
              suggested_quantity: [(high - available).ceil, 0].max)
    end

    def status(available, expected, high)
      return "short" if available < expected
      return "tight" if available < high

      "ok"
    end

    def weighted_mean(quantities)
      weights = quantities.each_index.map { |index| DECAY**index }
      quantities.zip(weights).sum { |quantity, weight| quantity * weight } / weights.sum
    end

    def standard_deviation(quantities)
      mean = quantities.sum.to_f / quantities.size
      Math.sqrt(quantities.sum { |quantity| (quantity - mean)**2 } / (quantities.size - 1))
    end

    def parts
      @parts ||= Part.unscoped.where(organization_id: @organization.id).index_by(&:id)
    end

    # What has been ordered and not come in yet, by part.
    def ordered
      @ordered ||= PurchaseOrderLine.joins(:purchase_order)
                                    .where(purchase_orders: { organization_id: @organization.id,
status: %w[ordered partially_received] })
                                    .group(:part_id).sum("purchase_order_lines.quantity - purchase_order_lines.quantity_received")
                                    .transform_values { |outstanding| [outstanding.to_f, 0.0].max }
    end

    # Those that may run short first, then those that are tight, then the rest by name.
    def sorted(rows)
      order = { "short" => 0, "tight" => 1, "ok" => 2 }
      rows.sort_by { |row| [order.fetch(row.status), row.days_of_stock || Float::INFINITY, row.part.name.downcase] }
    end
  end
end
