FactoryBot.define do
  factory :pm_execution do
    association :preventive_maintenance
    scheduled_date { Date.today }
    status         { :pending }

    trait :generated do
      status       { :generated }
      generated_at { Time.current }
    end

    trait :skipped do
      status      { :skipped }
      skip_reason { "Equipment unavailable" }
    end

    trait :completed do
      status { :completed }
    end
  end
end
