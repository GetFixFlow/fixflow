class WorkOrderMailer < ApplicationMailer
  default from: ENV.fetch("MAILER_FROM", "noreply@fixflow.dev")

  def assigned(work_order)
    @work_order = work_order
    @assignee   = work_order.assignee
    mail(
      to:      @assignee.email,
      subject: "[FixFlow] Work Order Assigned: #{work_order.work_order_number}"
    )
  end

  def needs_verification(work_order, manager)
    @work_order = work_order
    @manager    = manager
    mail(
      to:      manager.email,
      subject: "[FixFlow] Ready for Verification: #{work_order.work_order_number}"
    )
  end

  def verified(work_order)
    @work_order = work_order
    @requester  = work_order.requester
    mail(
      to:      @requester.email,
      subject: "[FixFlow] Work Order Completed: #{work_order.work_order_number}"
    )
  end

  def verified_public(work_order)
    @work_order = work_order
    mail(
      to:      work_order.requester_email,
      subject: "[FixFlow] Your Maintenance Request Has Been Completed"
    )
  end

  def new_request(work_order, manager)
    @work_order = work_order
    @manager    = manager
    mail(
      to:      manager.email,
      subject: "[FixFlow] New Maintenance Request Submitted"
    )
  end
end
