FactoryBot.define do
  factory :iot_alert do
    iot_rule
    asset           { iot_rule.asset }
    sensor_reading
    metric_name     { iot_rule.metric_name }
    triggered_value { 95.0 }
    threshold       { iot_rule.threshold }
    operator        { iot_rule.operator }
    status          { :open }

    trait :acknowledged do
      status          { :acknowledged }
      acknowledged_at { Time.current }
      association :acknowledged_by, factory: :user
    end

    trait :resolved do
      status      { :resolved }
      resolved_at { Time.current }
    end

    trait :with_work_order do
      association :work_order
    end
  end
end
