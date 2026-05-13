class PmDueSoonNotificationJob < ApplicationJob
  queue_as :notifications

  def perform
    pms = PreventiveMaintenance
      .status_active
      .due_within(7)
      .includes(:organization, :asset, :assigned_to)

    # Group by assigned technician and email each one
    pms.select(&:assigned_to).group_by(&:assigned_to).each do |technician, tech_pms|
      PmMailer.due_soon_summary(technician, tech_pms).deliver_later
    end

    # Notify all managers per organization
    pms.group_by(&:organization).each do |org, org_pms|
      org.users.managers.each do |manager|
        PmMailer.due_soon_summary(manager, org_pms).deliver_later
      end
    end

    Rails.logger.info "[PmDueSoonNotificationJob] Notified for #{pms.count} upcoming PMs"
  end
end
