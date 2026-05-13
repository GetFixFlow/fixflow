class WorkOrderPolicy < ApplicationPolicy
  def index?  = technician?
  def create? = technician?
  def destroy? = manager?
  def assign?  = manager?
  def verify?  = manager? && record.assignee_id != user.id
  def reject?  = manager?
  def hold?    = technician?
  def cancel?  = manager?
  def complete? = technician?
  def start?    = technician?

  def show?
    return false unless technician?
    manager? || record.assignee_id == user.id || record.requester_id == user.id
  end

  def update?
    manager? || record.assignee_id == user.id
  end

  class Scope < ApplicationPolicy::Scope
    def resolve
      if user.admin? || user.manager?
        scope.all
      elsif user.technician?
        scope.where(assignee_id: user.id)
      else
        scope.where(requester_id: user.id)
      end
    end
  end
end
