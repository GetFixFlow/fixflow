FactoryBot.define do
  factory :sensor_anomaly do
    organization
    asset { association :asset, organization: organization }
    metric_name    { "temperature" }
    unit           { "°C" }
    value          { 91.2 }
    usual_low      { 62 }
    usual_high     { 74 }
    usual_middle   { 68 }
    score          { 9.5 }
    baseline_count { 300 }
    recorded_at    { Time.current }
  end
end
