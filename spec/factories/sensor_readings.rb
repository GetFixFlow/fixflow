FactoryBot.define do
  factory :sensor_reading do
    asset
    organization { asset.organization }
    metric_name  { "temperature" }
    value        { 72.4 }
    unit         { "celsius" }
    source       { :rest_api }
    quality      { :good }
    recorded_at  { Time.current }
    received_at  { Time.current }
    raw_payload  { { "metric" => metric_name, "value" => value } }

    trait :mqtt do
      source { :mqtt }
    end

    trait :vibration do
      metric_name { "vibration" }
      value       { 3.2 }
      unit        { "mm/s" }
    end

    trait :pressure do
      metric_name { "pressure" }
      value       { 4.1 }
      unit        { "bar" }
    end

    trait :bad_quality do
      quality { :bad }
    end
  end
end
