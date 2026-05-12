FactoryBot.define do
  factory :work_order do
    organization
    asset
    title       { Faker::Lorem.sentence(word_count: 4) }
    description { Faker::Lorem.paragraph }
    priority    { "medium" }
    status      { "open" }
    checklist   { [] }

    trait :critical do
      priority { "critical" }
    end

    trait :completed do
      status       { "completed" }
      completed_at { 1.hour.ago }
    end

    trait :overdue do
      due_date { 2.days.ago }
    end
  end
end
