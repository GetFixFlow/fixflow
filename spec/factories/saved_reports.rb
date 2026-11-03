FactoryBot.define do
  factory :saved_report do
    organization
    user { association :user, :manager, organization: organization }
    sequence(:name) { |n| "Saved view #{n}" }
    report { "work_orders" }
    period { "last_30_days" }
    filters { {} }

    # Emailed on a weekday to the given managers.
    trait :emailed do
      send_on { 1 }
      recipient_ids { [user_id] }
    end
  end
end
