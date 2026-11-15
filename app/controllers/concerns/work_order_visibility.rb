# Which of the company's work orders the signed-in person may open. Everyone who works on maintenance (technicians,
# managers, administrators) sees them all, because a technician picks up work nobody has taken and looks at an asset's
# history; a requester sees only the requests they made themselves. A work order outside this scope is "not found", so
# its existence is not revealed either.
module WorkOrderVisibility
  def visible_work_orders
    scope = current_organization.work_orders
    current_user.requester? ? scope.where(requester_id: current_user.id) : scope
  end
end
