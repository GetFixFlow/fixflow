FactoryBot.define do
  factory :iot_rule do
    organization
    asset
    name             { "#{metric_name} threshold alert" }
    metric_name      { "temperature" }
    operator         { :gt }
    threshold        { 85.0 }
    wo_priority      { :high }
    auto_create_wo   { true }
    status           { :active }
    cooldown_minutes { 60 }

    trait :paused do
      status { :paused }
    end

    trait :archived do
      status { :archived }
    end

    trait :outside_range do
      operator       { :outside_range }
      threshold      { 10.0 }
      threshold_max  { 90.0 }
      metric_name    { "humidity" }
    end

    trait :no_cooldown do
      cooldown_minutes { 0 }
    end

    trait :with_sustained do
      sustained_duration_seconds { 300 }
    end

    trait :auto_wo_disabled do
      auto_create_wo { false }
    end

    trait :critical do
      wo_priority { :critical }
    end
  end
end
