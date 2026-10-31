FactoryBot.define do
  factory :purchase_order do
    organization
    reason { "Running low" }

    # One line unless told otherwise: the part is the company's own.
    after(:build) do |order|
      order.lines.build(part: create(:part, organization: order.organization), quantity: 5, unit_cost: 12.5) if order.lines.empty?
    end

    trait :approved do
      status { "approved" }
    end

    trait :ordered do
      status { "ordered" }
      vendor { association :vendor, organization: organization }
      ordered_at { Time.current }
    end
  end

  factory :purchase_order_line do
    purchase_order
    part { association :part, organization: purchase_order.organization }
    quantity { 5 }
    unit_cost { 12.5 }
  end
end
