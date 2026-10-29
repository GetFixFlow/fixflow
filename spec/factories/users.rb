FactoryBot.define do
  factory :user do
    organization
    email                 { Faker::Internet.unique.email }
    password              { "password123" }
    password_confirmation { "password123" }
    # The factory's password is a weak one on purpose (specs sign in with it); specs of the rules turn this off.
    skip_password_policy  { true }
    first_name            { Faker::Name.first_name }
    last_name             { Faker::Name.last_name }
    role                  { "technician" }

    trait :admin do
      role { "admin" }
    end

    trait :manager do
      role { "manager" }
    end

    trait :requester do
      role { "requester" }
    end
  end
end
