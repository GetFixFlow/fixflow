class PreventiveMaintenanceBlueprint < Blueprinter::Base
  identifier :id

  # ─── Default view ─────────────────────────────────────────────────────────
  fields :name, :status, :priority, :frequency_type, :frequency_value,
    :frequency_unit, :next_due_at, :last_run_at, :times_generated,
    :times_completed, :created_at, :updated_at

  field(:asset) do |pm|
    next nil unless pm.asset
    { id: pm.asset.id, name: pm.asset.name, asset_tag: pm.asset.asset_tag }
  end

  field(:assigned_to) do |pm|
    next nil unless pm.assigned_to
    { id: pm.assigned_to.id, full_name: pm.assigned_to.full_name, role: pm.assigned_to.role }
  end

  # ─── Extended view ────────────────────────────────────────────────────────
  view :extended do
    include_view :default

    fields :description, :template, :start_date, :end_date,
      :times_skipped, :estimated_hours

    field(:recent_executions) do |pm|
      PmExecutionBlueprint.render_as_hash(pm.pm_executions.recent.limit(5))
    end
  end
end
