FactoryBot.define do
  factory :organization do
    name      { Faker::Company.name }
    subdomain { Faker::Internet.unique.slug(glue: "-") }
    settings  { {} }
  end
end
