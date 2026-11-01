FactoryBot.define do
  factory :custom_field do
    organization
    entity { "work_order" }
    sequence(:label) { |n| "Field #{n}" }
    kind { "text" }

    trait :part do
      entity { "part" }
    end

    trait :number do
      kind { "number" }
    end

    trait :date do
      kind { "date" }
    end

    trait :checkbox do
      kind { "checkbox" }
    end

    trait :select do
      kind { "select" }
      options { %w[Low Medium High] }
    end

    trait :required do
      required { true }
    end

    trait :off do
      active { false }
    end
  end
end
