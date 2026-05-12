class PreventiveMaintenanceBlueprint < Blueprinter::Base
  identifier :id
  fields :name, :frequency_type, :frequency_value, :frequency_unit,
    :last_run_at, :next_due_at, :active, :template, :asset_id,
    :organization_id, :created_at, :updated_at

  association :asset, blueprint: AssetBlueprint
end
