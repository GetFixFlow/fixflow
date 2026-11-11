module PublicApi
  # A work order as the public API and webhooks show it. A shape programs depend on, so a field is only added (never
  # renamed or removed) within a version. What the work cost in wages is not here: it reveals what people are paid.
  class WorkOrderBlueprint < Blueprinter::Base
    identifier :id

    field(:number, &:work_order_number)
    fields :title, :description, :status, :priority, :due_date, :started_at, :completed_at, :verified_at, :completion_notes,
           :cancellation_reason, :custom_values, :created_at, :updated_at
    # Numbers are sent as numbers (the database's exact decimals would arrive as text).
    field(:estimated_hours) { |wo| wo.estimated_hours&.to_f }
    field(:actual_hours) { |wo| wo.actual_hours&.to_f }

    field(:asset) { |wo| wo.asset && { id: wo.asset.id, name: wo.asset.name, asset_tag: wo.asset.asset_tag } }
    field(:assignee) { |wo| wo.assignee && { id: wo.assignee.id, name: wo.assignee.full_name, email: wo.assignee.email } }
    field(:requester) do |wo|
      if wo.requester
        { id: wo.requester.id, name: wo.requester.full_name, email: wo.requester.email }
      elsif wo.requester_name.present?
        { id: nil, name: wo.requester_name, email: wo.requester_email }
      end
    end
    field(:url) { |wo| "#{EmailSetup.base_url}/work-orders/#{wo.id}" }
  end
end
