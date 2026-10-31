FactoryBot.define do
  factory :asset_downtime do
    organization
    asset { association :asset, organization: organization }
    started_at { 5.hours.ago }
    ended_at   { 2.hours.ago }

    # Still going on. The asset is "down" too, as it is in the app.
    trait :open do
      ended_at { nil }
      after(:build) { |downtime| downtime.asset.update_columns(status: "down") } # rubocop:disable Rails/SkipsModelValidations
    end
  end
end
