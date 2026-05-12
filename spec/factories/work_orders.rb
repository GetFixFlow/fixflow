FactoryBot.define do
  factory :work_order do
    organization
    asset
    sequence(:work_order_number) { |n| format("WO-%06d", n) }
    title       { Faker::Lorem.sentence(word_count: 4) }
    description { Faker::Lorem.paragraph }
    priority    { "medium" }
    status      { "open" }
    checklist   { [] }

    trait :critical do
      priority { "critical" }
    end

    trait :with_assignee do
      association :assignee, factory: :user
    end

    trait :assigned do
      status { "assigned" }
      association :assignee, factory: :user
    end

    trait :in_progress do
      status     { "in_progress" }
      started_at { 2.hours.ago }
      association :assignee, factory: :user
    end

    trait :on_hold do
      status { "on_hold" }
      association :assignee, factory: :user
    end

    trait :pending_parts do
      status { "pending_parts" }
      association :assignee, factory: :user
    end

    trait :completed do
      status           { "completed" }
      completed_at     { 1.hour.ago }
      completion_notes { Faker::Lorem.paragraph }
      association :assignee, factory: :user
    end

    trait :verified do
      status           { "verified" }
      completed_at     { 2.hours.ago }
      verified_at      { 1.hour.ago }
      completion_notes { Faker::Lorem.paragraph }
      association :assignee, factory: :user
      association :verified_by, factory: :user
    end

    trait :cancelled do
      status              { "cancelled" }
      cancellation_reason { "No longer needed" }
    end

    trait :overdue do
      due_date { 2.days.ago }
    end

    trait :public_request do
      requester_name  { Faker::Name.full_name }
      requester_email { Faker::Internet.email }
      sequence(:public_token) { |n| "token_#{n}" }
    end
  end
end
