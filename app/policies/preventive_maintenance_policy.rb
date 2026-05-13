class PreventiveMaintenancePolicy < ApplicationPolicy
  def index?   = technician?
  def show?    = technician?
  def create?  = manager?
  def update?  = manager?
  def destroy? = admin?
  def trigger? = manager?
  def pause?   = manager?
  def resume?  = manager?
  def skip?    = technician?
  def preview? = technician?

  class Scope < ApplicationPolicy::Scope
    def resolve = scope.all
  end
end
