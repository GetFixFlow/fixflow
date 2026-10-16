# Tells the managers and admins that a part has fallen to its reorder point or run out.
class LowStockAlertJob < ApplicationJob
  queue_as :notifications

  def perform(part_id, kind)
    part = ActsAsTenant.without_tenant { Part.find_by(id: part_id) }
    return unless part

    part.organization.users.managers.wanting_email("part_low_stock").each do |manager|
      PartMailer.low_stock(manager, part, kind).deliver_later
    end
  end
end
