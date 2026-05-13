FactoryBot.define do
  factory :sensor_aggregate do
    asset
    metric_name   { "temperature" }
    period_type   { :hourly }
    period_start  { 1.hour.ago.beginning_of_hour }
    min_value     { 68.0 }
    max_value     { 74.0 }
    avg_value     { 71.0 }
    reading_count { 6 }

    trait :daily do
      period_type  { :daily }
      period_start { Date.yesterday.beginning_of_day }
    end
  end
end
