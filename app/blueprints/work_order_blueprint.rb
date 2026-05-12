class WorkOrderBlueprint < Blueprinter::Base
  identifier :id
  fields :title, :description, :priority, :status, :checklist,
    :completion_notes, :due_date, :completed_at, :asset_id,
    :assignee_id, :requester_id, :organization_id, :created_at, :updated_at

  view :extended do
    fields :title, :description, :priority, :status, :checklist,
      :completion_notes, :due_date, :completed_at, :created_at, :updated_at
    association :asset, blueprint: AssetBlueprint, default: nil
    association :assignee, blueprint: UserBlueprint, default: nil
    association :requester, blueprint: UserBlueprint, default: nil
  end
end
