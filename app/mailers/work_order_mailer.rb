class WorkOrderMailer < ApplicationMailer
  default from: ENV.fetch("MAILER_FROM", "noreply@fixflow.dev")

  def assigned(work_order)
    @work_order = work_order
    @assignee   = work_order.assignee
    in_language_of(@assignee) do
      mail(to: @assignee.email, subject: t(".subject", number: work_order.work_order_number))
    end
  end

  def needs_verification(work_order, manager)
    @work_order = work_order
    @manager    = manager
    in_language_of(manager) do
      mail(to: manager.email, subject: t(".subject", number: work_order.work_order_number))
    end
  end

  def approval_needed(work_order, manager)
    @work_order = work_order
    @manager    = manager
    @url        = "#{EmailSetup.base_url}/work-orders/#{work_order.id}"
    in_language_of(manager) do
      mail(to: manager.email, subject: t(".subject", number: work_order.work_order_number))
    end
  end

  def verified(work_order)
    @work_order = work_order
    @requester  = work_order.requester
    in_language_of(@requester) do
      mail(to: @requester.email, subject: t(".subject", number: work_order.work_order_number))
    end
  end

  def verified_public(work_order)
    @work_order = work_order
    in_language_of_organization(work_order.organization) do
      mail(to: work_order.requester_email, subject: t(".subject"))
    end
  end

  def new_request(work_order, manager)
    @work_order = work_order
    @manager    = manager
    in_language_of(manager) { mail(to: manager.email, subject: t(".subject")) }
  end
end
