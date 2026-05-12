FactoryBot.define do
  factory :location do
    organization
    name          { Faker::Address.community }
    location_type { "site" }

    trait :building do
      location_type { "building" }
    end

    trait :floor do
      location_type { "floor" }
    end

    trait :room do
      location_type { "room" }
    end

    trait :zone do
      location_type { "zone" }
    end

    # Creates a child location under a given parent.
    # Usage: create(:location, :with_parent, parent: site_location)
    trait :with_parent do
      transient { parent { nil } }
      after(:build) { |loc, ev| loc.parent = ev.parent if ev.parent }
    end
  end
end
