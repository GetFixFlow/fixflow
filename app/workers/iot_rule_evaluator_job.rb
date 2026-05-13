class IoTRuleEvaluatorJob < ApplicationJob
  queue_as :iot

  # Legacy worker — delegates to the new IoT service layer.
  def perform(asset_id, readings)
    asset = Asset.find_by(id: asset_id)
    return unless asset

    readings.each do |metric_name, raw_value|
      reading_data = { "metric" => metric_name.to_s, "value" => raw_value.to_f }
      Iot::IngestionService.ingest(asset, [reading_data], source: :rest_api)
    end
  end
end
