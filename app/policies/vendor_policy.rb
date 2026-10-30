class VendorPolicy < ApplicationPolicy
  # Whoever works on equipment may need to ring the contractor; what they charged is on the work order, for managers.
  def index?   = technician?
  def show?    = technician?
  def create?  = manager?
  def update?  = manager?
  def destroy? = admin?

  class Scope < ApplicationPolicy::Scope
    def resolve = scope.all
  end
end
