FactoryBot.define do
  factory :preventive_maintenance do
    organization
    asset
    sequence(:name) { |n| "PM Schedule #{n}" }
    description    { Faker::Lorem.sentence }
    priority       { :medium }
    status         { :active }
    frequency_type { :time_based }
    frequency_value { 30 }
    frequency_unit  { "days" }
    start_date      { Date.today }
    next_due_at     { 1.day.from_now }
    template do
      {
        "title"       => "Monthly PM - {asset_name}",
        "description" => "Routine preventive maintenance",
        "checklist"   => [
          { "step" => 1, "instruction" => "Inspect equipment", "required" => true },
          { "step" => 2, "instruction" => "Lubricate moving parts", "required" => true },
          { "step" => 3, "instruction" => "Test operation", "required" => false }
        ],
        "estimated_hours" => 2.0
      }
    end

    trait :active_pm do
      status      { :active }
      next_due_at { 1.day.from_now }
    end

    trait :overdue_pm do
      status      { :active }
      next_due_at { 10.days.ago }
    end

    trait :paused_pm do
      status { :paused }
    end

    trait :archived do
      status { :archived }
    end

    trait :meter_based_pm do
      frequency_type  { :meter_based }
      frequency_value { 500 }
      frequency_unit  { "hours" }
    end

    trait :calendar_based do
      frequency_type  { :calendar_based }
      frequency_value { 1 }
      frequency_unit  { "months" }
    end

    trait :with_assigned_to do
      association :assigned_to, factory: :user
    end

    trait :critical do
      priority { :critical }
    end
  end
end
