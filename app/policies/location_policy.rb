class LocationPolicy < ApplicationPolicy
  def index?   = technician?
  def show?    = technician?
  def create?  = manager?
  def update?  = manager?
  def destroy? = admin?

  class Scope < ApplicationPolicy::Scope
    def resolve = scope.all
  end
end
