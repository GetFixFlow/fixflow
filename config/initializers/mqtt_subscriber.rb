if (Rails.env.production? || Rails.env.development?) &&
    !defined?(Rails::Console) &&
    File.basename($PROGRAM_NAME) != "rake" &&
    !Rails.const_defined?("Generators")

  Thread.new do
    # Small delay to let Rails fully boot before connecting
    sleep 3
    # Only one process may listen (see start_here?); asked here because the class cannot be loaded while Rails boots.
    Iot::MqttSubscriberService.start if Iot::MqttSubscriberService.start_here?
  rescue => e
    Rails.logger.error "[MQTT] Subscriber thread died: #{e.message}"
  end
end
