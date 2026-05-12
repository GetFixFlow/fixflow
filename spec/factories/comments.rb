FactoryBot.define do
  factory :comment do
    association :commentable, factory: :work_order
    user
    body     { Faker::Lorem.sentence }
    internal { false }

    trait :internal do
      internal { true }
    end
  end
end
