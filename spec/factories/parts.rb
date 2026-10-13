FactoryBot.define do
  factory :part do
    organization
    sequence(:name) { |n| "Part #{n}" }
    sequence(:sku)  { |n| "SKU-#{1000 + n}" }
    quantity_on_hand { 10 }
    reorder_point    { 2 }
    unit             { "each" }
    unit_cost        { 12.5 }
  end

  factory :work_order_part do
    work_order
    part { association :part, organization: work_order.organization }
    quantity_used { 1 }
    unit_cost     { 12.5 }
  end
end
