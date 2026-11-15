module Iot
  # Looks at one stored sensor reading to see whether it is far outside what that sensor usually reads (Iot::AnomalyDetector),
  # and tells the company's chat channel when it is. Only for a company that has AI on and has not switched this feature off.
  class AnomalyCheckJob < ApplicationJob
    queue_as :iot

    def perform(sensor_reading_id)
      reading = SensorReading.unscoped.find_by(id: sensor_reading_id)
      return unless reading

      organization = reading.asset&.organization
      return unless organization && ::Ai::Client.config(organization).feature?(:anomalies)

      anomaly = Iot::AnomalyDetector.check(reading)
      post_to_chat(organization, anomaly) if anomaly
    end

    private

    def post_to_chat(organization, anomaly)
      ChatNotifier.post(organization, "sensor_anomaly", title: "Unusual sensor reading: #{anomaly.asset.name}",
                                                        body: anomaly.message, path: "/iot")
    end
  end
end
