FactoryBot.define do
  factory :activity_log do
    organization
    association :user
    action        { "work_order.completed" }
    resource_type { "WorkOrder" }
    resource_id   { 1 }
    resource_name { "WO-000001" }
    metadata      { {} }
    ip_address    { "127.0.0.1" }

    trait :system do
      user { nil }
    end

    trait :asset_action do
      action        { "asset.status_changed" }
      resource_type { "Asset" }
      resource_name { "Pump A" }
    end
  end
end
