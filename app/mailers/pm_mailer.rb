class PmMailer < ApplicationMailer
  default from: ENV.fetch("MAILER_FROM", "noreply@fixflow.dev")

  def due_soon_summary(user, pm_list)
    @user    = user
    @pm_list = pm_list
    in_language_of(user) { mail(to: user.email, subject: t(".subject", count: pm_list.size)) }
  end

  def overdue_summary(manager, pm_list)
    @manager = manager
    @pm_list = pm_list
    in_language_of(manager) { mail(to: manager.email, subject: t(".subject", count: pm_list.size)) }
  end

  def work_order_generated(pm, work_order)
    @pm         = pm
    @work_order = work_order
    @assignee   = pm.assigned_to
    in_language_of(@assignee) do
      mail(to: @assignee.email, subject: t(".subject", number: work_order.work_order_number))
    end
  end
end
