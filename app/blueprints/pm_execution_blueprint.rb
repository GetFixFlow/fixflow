class PmExecutionBlueprint < Blueprinter::Base
  identifier :id

  fields :scheduled_date, :generated_at, :status, :skip_reason, :notes, :created_at

  field(:work_order) do |exec|
    next nil unless exec.work_order
    {
      id:                exec.work_order.id,
      work_order_number: exec.work_order.work_order_number,
      status:            exec.work_order.status
    }
  end
end
