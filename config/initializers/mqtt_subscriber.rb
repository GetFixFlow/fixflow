if (Rails.env.production? || Rails.env.development?) &&
    !defined?(Rails::Console) &&
    File.basename($PROGRAM_NAME) != "rake" &&
    !Rails.const_defined?("Generators")

  Thread.new do
    # Small delay to let Rails fully boot before connecting
    sleep 3
    Iot::MqttSubscriberService.start
  rescue => e
    Rails.logger.error "[MQTT] Subscriber thread died: #{e.message}"
  end
end
