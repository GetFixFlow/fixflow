class PurchaseOrderPolicy < ApplicationPolicy
  # Anyone who works on equipment can ask for parts and see their own requests; managers see them all and decide.
  def index?   = technician?
  def show?    = manager? || mine?
  def create?  = technician?
  def update?  = manager? ? record.editable? : (mine? && record.requested?)
  def approve? = manager?
  def reject?  = manager?
  def order?   = manager?
  def receive? = manager?
  def close?   = manager?
  def cancel?  = manager? || (mine? && record.requested?)

  class Scope < ApplicationPolicy::Scope
    def resolve = user.manager_or_above? ? scope.all : scope.where(requested_by_id: user.id)
  end

  private

  def mine? = record.is_a?(PurchaseOrder) && record.requested_by_id == user.id
end
