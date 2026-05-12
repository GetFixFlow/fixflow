FactoryBot.define do
  factory :iot_rule do
    organization
    asset
    name         { "#{metric_name} threshold alert" }
    metric_name  { "temperature" }
    operator     { "gt" }
    threshold    { 85.0 }
    priority     { "high" }
    auto_create_wo { true }
    active       { true }
    cooldown_minutes { 60 }
  end
end
