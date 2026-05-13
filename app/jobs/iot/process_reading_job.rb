module Iot
  class ProcessReadingJob < ApplicationJob
    queue_as :iot

    def perform(asset_id, readings_array, source, device_id: nil)
      asset = Asset.find_by(id: asset_id)
      unless asset
        Rails.logger.warn "[Iot::ProcessReadingJob] Asset #{asset_id} not found"
        return
      end

      Iot::IngestionService.ingest(
        asset,
        readings_array,
        source:    source.to_sym,
        device_id: device_id
      )
    end
  end
end
