# Records a reading on a Meter and moves the meter's current reading to it. A meter only counts up, so a lower value is
# refused unless it is a reset (the meter was replaced, or rolled over): a reset also starts the maintenance schedules
# that follow the meter again, a full interval from the new value. A sensor's reading older than the current one is
# dropped, and a sensor's history is kept at most once an hour (it can report every few seconds).
class MeterReadingRecorder
  class Rejected < StandardError; end

  SENSOR_HISTORY_EVERY = 1.hour

  # value: the reading. Options: by (the User), at, source (:manual or :sensor), reset, note.
  def self.call(meter, value:, **options)
    number = BigDecimal(value.to_s)
    raise Rejected, "Enter the reading as a number." unless number.finite?

    new(meter, number, options).call
  rescue ArgumentError, TypeError
    raise Rejected, "Enter the reading as a number."
  end

  def initialize(meter, value, options)
    @meter = meter
    @value = value
    @by = options[:by]
    @at = options.fetch(:at, Time.current)
    @source = options.fetch(:source, :manual).to_sym
    @reset = options[:reset] == true
    @note = options[:note].to_s.strip.presence
  end

  def call
    reading = nil
    @meter.with_lock do
      return nil if @source == :sensor && !advance_from_sensor?

      reject_if_lower!
      reading = create_history_line if keep_history?
      @meter.update!(reading: @value, last_reading_at: @at)
      PmMeterService.rebase(@meter) if @reset
    end
    PmMeterService.check(@meter)
    reading
  rescue ActiveRecord::RecordInvalid => e
    raise Rejected, e.record.errors.full_messages.to_sentence
  end

  private

  def create_history_line
    @meter.readings.create!(value: @value, recorded_at: @at, source: @source, recorded_by: @by, reset: @reset, note: @note)
  end

  # A sensor only ever moves a meter forward, and only with a newer reading.
  def advance_from_sensor?
    @value > @meter.reading && (@meter.last_reading_at.nil? || @at >= @meter.last_reading_at)
  end

  def reject_if_lower!
    return if @reset || @value >= @meter.reading

    raise Rejected, "That is lower than the last reading, #{@meter.reading.to_s('F')} #{@meter.unit}. " \
                    "A meter only counts up: if it was replaced or reset, say so."
  end

  def keep_history?
    return true unless @source == :sensor

    last = @meter.readings.sensor.maximum(:recorded_at)
    last.nil? || @at - last >= SENSOR_HISTORY_EVERY
  end
end
