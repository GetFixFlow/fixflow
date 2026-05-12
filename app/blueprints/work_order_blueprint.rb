class WorkOrderBlueprint < Blueprinter::Base
  identifier :id

  # ─── Default view ──────────────────────────────────────────────────────────

  fields :work_order_number, :title, :priority, :status,
    :asset_id, :assignee_id, :requester_id, :organization_id,
    :due_date, :created_at, :updated_at

  field(:asset) do |wo|
    wo.asset ? { id: wo.asset.id, name: wo.asset.name, asset_tag: wo.asset.asset_tag } : nil
  end

  field(:assignee) do |wo|
    wo.assignee ? { id: wo.assignee.id, full_name: wo.assignee.full_name, email: wo.assignee.email } : nil
  end

  field(:requester) do |wo|
    if wo.requester
      { id: wo.requester.id, full_name: wo.requester.full_name, email: wo.requester.email }
    elsif wo.requester_name.present?
      { full_name: wo.requester_name, email: wo.requester_email }
    end
  end

  # ─── Extended view ─────────────────────────────────────────────────────────

  view :extended do
    fields :work_order_number, :title, :description, :priority, :status,
      :asset_id, :assignee_id, :requester_id, :organization_id,
      :due_date, :estimated_hours, :actual_hours,
      :started_at, :completed_at, :verified_at,
      :completion_notes, :rejection_reason, :cancellation_reason,
      :parts_cost, :labor_cost, :checklist, :created_at, :updated_at

    field(:asset) do |wo|
      wo.asset ? { id: wo.asset.id, name: wo.asset.name, asset_tag: wo.asset.asset_tag } : nil
    end

    field(:assignee) do |wo|
      wo.assignee ? { id: wo.assignee.id, full_name: wo.assignee.full_name, email: wo.assignee.email } : nil
    end

    field(:requester) do |wo|
      if wo.requester
        { id: wo.requester.id, full_name: wo.requester.full_name, email: wo.requester.email }
      elsif wo.requester_name.present?
        { full_name: wo.requester_name, email: wo.requester_email }
      end
    end

    field(:verified_by) do |wo|
      wo.verified_by ? { id: wo.verified_by.id, full_name: wo.verified_by.full_name } : nil
    end

    association :comments, blueprint: CommentBlueprint do |wo, _opts|
      wo.comments.order(created_at: :desc).limit(5)
    end

    association :attachments, blueprint: AttachmentBlueprint

    field(:parts_used) do |wo|
      wo.work_order_parts.includes(:part).map do |wop|
        {
          id:            wop.id,
          part_id:       wop.part_id,
          name:          wop.part.name,
          quantity_used: wop.quantity_used,
          unit_cost:     wop.unit_cost
        }
      end
    end
  end
end
