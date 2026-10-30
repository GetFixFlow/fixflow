class WorkOrderBlueprint < Blueprinter::Base
  identifier :id

  # ─── Default view ──────────────────────────────────────────────────────────

  fields :work_order_number, :title, :priority, :status,
    :asset_id, :assignee_id, :requester_id, :vendor_id, :organization_id,
    :due_date, :created_at, :updated_at

  field(:asset) do |wo|
    wo.asset ? { id: wo.asset.id, name: wo.asset.name, asset_tag: wo.asset.asset_tag } : nil
  end

  field(:assignee) do |wo|
    wo.assignee ? { id: wo.assignee.id, full_name: wo.assignee.full_name, email: wo.assignee.email } : nil
  end

  field(:vendor) do |wo|
    wo.vendor ? { id: wo.vendor.id, name: wo.vendor.name } : nil
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
      :asset_id, :assignee_id, :requester_id, :vendor_id, :organization_id,
      :due_date, :estimated_hours, :actual_hours,
      :started_at, :completed_at, :verified_at,
      :completion_notes, :rejection_reason, :cancellation_reason,
      :parts_cost, :checklist, :created_at, :updated_at

    # What the work cost in wages reveals what people are paid: managers and administrators only
    # (pass `labor: true`).
    field(:labor_cost) { |wo, options| options[:labor] ? wo.labor_cost : nil }
    field(:labor_rate) { |wo, options| options[:labor] ? wo.labor_rate : nil }
    # What an outside company charged is a manager's to see, as wages are.
    field(:vendor_cost) { |wo, options| options[:labor] ? wo.vendor_cost : nil }
    field(:vendor_reference) { |wo, options| options[:labor] ? wo.vendor_reference : nil }

    field(:asset) do |wo|
      wo.asset ? { id: wo.asset.id, name: wo.asset.name, asset_tag: wo.asset.asset_tag } : nil
    end

    field(:vendor) do |wo|
      wo.vendor ? { id: wo.vendor.id, name: wo.vendor.name } : nil
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
      WorkOrderPartBlueprint.render_as_hash(wo.work_order_parts.includes(:part).order(:id))
    end
  end
end
