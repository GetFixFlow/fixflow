FactoryBot.define do
  factory :api_key do
    organization
    name        { "Test Gateway" }
    key_digest  { BCrypt::Password.create("fxk_testkey123") }
    active      { true }
    scopes      { ["iot:write"] }

    trait :expired do
      expires_at { 1.day.ago }
    end

    trait :inactive do
      active { false }
    end
  end
end
