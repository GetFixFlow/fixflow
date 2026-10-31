class AssetDowntimePolicy < ApplicationPolicy
  def index?   = technician?
  # Whoever works on the equipment can say it stopped, and that it runs again; correcting or deleting a record is a
  # manager's call.
  def create?  = technician?
  def restart? = technician?
  def update?  = manager?
  def destroy? = manager?

  class Scope < ApplicationPolicy::Scope
    def resolve = scope.all
  end
end
