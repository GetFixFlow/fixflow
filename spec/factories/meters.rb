FactoryBot.define do
  factory :meter do
    organization
    asset { association :asset, organization: organization }
    sequence(:name) { |n| "Running hours #{n}" }
    unit    { "hours" }
    reading { 0 }

    trait :fed_by_sensor do
      sensor_metric { "running_hours" }
    end
  end

  factory :meter_reading do
    meter
    value       { 10 }
    recorded_at { Time.current }
    source      { :manual }
  end
end
