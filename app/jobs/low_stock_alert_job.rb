# Tells the managers and admins that a part has fallen to its reorder point or run out.
class LowStockAlertJob < ApplicationJob
  queue_as :notifications

  def perform(part_id, kind)
    part = ActsAsTenant.without_tenant { Part.find_by(id: part_id) }
    return unless part

    managers = part.organization.users.managers
    managers.wanting_email("part_low_stock").each do |manager|
      PartMailer.low_stock(manager, part, kind).deliver_later
    end
    managers.each do |manager|
      title = kind.to_s == "out" ? "Out of stock: #{part.name}" : "Running low: #{part.name}"
      left = part.quantity_on_hand.to_f.round(2)
      reorder = part.reorder_point.to_f.round(2)
      manager.push!("part_low_stock", title: title, body: "#{left} left (reorder at #{reorder})", path: "/parts")
    end
  end
end
