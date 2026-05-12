class IotRuleBlueprint < Blueprinter::Base
  identifier :id
  fields :name, :metric_name, :operator, :threshold, :priority,
    :auto_create_wo, :active, :duration_seconds,
    :work_order_title_template, :cooldown_minutes,
    :asset_id, :organization_id, :created_at, :updated_at
end
