FactoryBot.define do
  factory :preventive_maintenance do
    organization
    asset { association :asset, organization: organization }
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

    # The model recalculates next_due_at from the frequency the first time it is saved.
    # Specs choose their own due date, so restore it after create.
    before(:create) { |pm| pm.instance_variable_set(:@spec_next_due_at, pm.next_due_at) }
    after(:create) do |pm|
      due = pm.instance_variable_get(:@spec_next_due_at)
      pm.update_column(:next_due_at, due) if due
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

    # Falls due 500 hours after the meter's reading when it is made (the meter starts at 0 unless a spec says otherwise).
    trait :meter_based_pm do
      frequency_type  { :meter_based }
      frequency_value { 500 }
      frequency_unit  { "hours" }
      meter { association :meter, organization: organization, asset: asset, unit: "hours" }
      next_due_at     { nil }
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
