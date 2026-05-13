class PmOverdueNotificationJob < ApplicationJob
  queue_as :notifications

  def perform
    overdue_pms = PreventiveMaintenance
      .status_active
      .overdue
      .includes(:organization, :asset)

    # Notify managers per organization
    overdue_pms.group_by(&:organization).each do |org, org_pms|
      org.users.managers.each do |manager|
        PmMailer.overdue_summary(manager, org_pms).deliver_later
      end
    end

    # Degrade assets with severely overdue PMs (> 7 days)
    overdue_pms.each do |pm|
      next unless pm.next_due_at
      days_overdue = (Time.current - pm.next_due_at) / 1.day
      next unless days_overdue > 7 && pm.asset

      pm.asset.update_column(:status, "degraded") if pm.asset.status == "operational"
    rescue => e
      Rails.logger.error "[PmOverdueNotificationJob] Asset update failed for PM ##{pm.id}: #{e.message}"
    end

    Rails.logger.info "[PmOverdueNotificationJob] Processed #{overdue_pms.count} overdue PMs"
  end
end
