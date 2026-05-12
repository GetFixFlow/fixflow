FactoryBot.define do
  factory :attachment do
    work_order
    user
    description { Faker::Lorem.sentence }
  end
end
