module Iot
  class IngestionService
    # Ingest one or more readings for a known asset.
    #
    # readings_array - array of hashes with keys:
    #   metric  (String)
    #   value   (Numeric)
    #   unit    (String, optional)
    #   device_id (String, optional)
    #   device_name (String, optional)
    #   timestamp (String ISO8601, optional)
    #   quality (String: good/uncertain/bad, optional)
    #
    def self.ingest(asset, readings_array, source:, device_id: nil)
      results = { received: 0, processed: 0, alerts_triggered: 0, work_orders_created: 0, errors: [] }

      Array(readings_array).each do |reading_data|
        results[:received] += 1

        sensor_reading = build_sensor_reading(asset, reading_data, source: source, device_id: device_id)

        unless sensor_reading.save
          results[:errors] << { reading: reading_data, errors: sensor_reading.errors.full_messages }
          next
        end

        results[:processed] += 1

        broadcast_reading(sensor_reading)

        alert = Iot::RuleEvaluatorService.evaluate(asset, sensor_reading)

        if alert.is_a?(IotAlert)
          results[:alerts_triggered] += 1
          results[:work_orders_created] += 1 if alert.work_order_id.present?
        end
      rescue => e
        results[:errors] << { reading: reading_data, errors: [e.message] }
      end

      results
    end

    # Batch ingest where the asset must be looked up by id or tag.
    def self.ingest_batch(organization, readings_array, source:)
      results = { received: 0, processed: 0, alerts_triggered: 0, work_orders_created: 0, errors: [] }

      Array(readings_array).each do |reading_data|
        asset = find_asset(organization, reading_data)

        unless asset
          results[:errors] << { reading: reading_data, errors: ["Asset not found"] }
          next
        end

        single = ingest(asset, [reading_data], source: source, device_id: reading_data["device_id"])
        results[:received]          += single[:received]
        results[:processed]         += single[:processed]
        results[:alerts_triggered]  += single[:alerts_triggered]
        results[:work_orders_created] += single[:work_orders_created]
        results[:errors].concat(single[:errors])
      end

      results
    end

    private_class_method def self.build_sensor_reading(asset, data, source:, device_id:)
      recorded_at = if data["timestamp"].present?
        Time.parse(data["timestamp"])
      else
        Time.current
      end

      SensorReading.new(
        asset:        asset,
        organization: asset.organization,
        metric_name:  data["metric"].to_s,
        value:        data["value"].to_f,
        unit:         data["unit"],
        source:       source,
        device_id:    data["device_id"] || device_id,
        device_name:  data["device_name"],
        quality:      data["quality"]&.to_sym || :good,
        recorded_at:  recorded_at,
        received_at:  Time.current,
        raw_payload:  data
      )
    end

    private_class_method def self.find_asset(organization, data)
      identifier = data["asset_id"].to_s
      return nil if identifier.blank?

      organization.assets.find_by(id: identifier) ||
        organization.assets.find_by(asset_tag: identifier)
    end

    private_class_method def self.broadcast_reading(sensor_reading)
      ActionCable.server.broadcast(
        "iot_channel_asset_#{sensor_reading.asset_id}",
        {
          type:        "sensor_reading",
          asset_id:    sensor_reading.asset_id,
          metric:      sensor_reading.metric_name,
          value:       sensor_reading.value,
          unit:        sensor_reading.unit,
          recorded_at: sensor_reading.recorded_at
        }
      )
    end
  end
end
