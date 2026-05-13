class PmMailer < ApplicationMailer
  default from: ENV.fetch("MAILER_FROM", "noreply@fixflow.dev")

  def due_soon_summary(user, pm_list)
    @user    = user
    @pm_list = pm_list
    mail(
      to:      user.email,
      subject: "[FixFlow] #{pm_list.size} Preventive Maintenance Schedule(s) Due This Week"
    )
  end

  def overdue_summary(manager, pm_list)
    @manager = manager
    @pm_list = pm_list
    mail(
      to:      manager.email,
      subject: "[FixFlow] #{pm_list.size} Overdue PM Schedule(s) Require Attention"
    )
  end

  def work_order_generated(pm, work_order)
    @pm         = pm
    @work_order = work_order
    @assignee   = pm.assigned_to
    mail(
      to:      @assignee.email,
      subject: "[FixFlow] PM Work Order Auto-Generated: #{work_order.work_order_number}"
    )
  end
end
