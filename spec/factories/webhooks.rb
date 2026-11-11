FactoryBot.define do
  factory :webhook do
    organization
    name   { "n8n" }
    url    { "https://hooks.example.test/in/abc" }
    events { %w[work_order.completed] }
    active { true }
  end
end
