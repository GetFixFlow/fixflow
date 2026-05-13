class IoTRuleEvaluatorJob < ApplicationJob
  queue_as :iot

  # Kept for backward compatibility with old REST ingest endpoint.
  # New ingestion goes through Iot::ProcessReadingJob → Iot::IngestionService.
  def perform(asset_id, readings)
    asset = Asset.find_by(id: asset_id)
    return unless asset

    readings.each do |metric_name, raw_value|
      reading_data = { "metric" => metric_name.to_s, "value" => raw_value.to_f }
      Iot::IngestionService.ingest(asset, [reading_data], source: :rest_api)
    end
  end
end
