FactoryBot.define do
  factory :vendor do
    organization
    sequence(:name) { |n| "Vendor #{n}" }
    category { "Electrical" }
    phone    { "555-0100" }
  end

  factory :vendor_contact do
    vendor
    sequence(:name) { |n| "Contact #{n}" }
    role  { "Dispatcher" }
    phone { "555-0101" }
  end
end
