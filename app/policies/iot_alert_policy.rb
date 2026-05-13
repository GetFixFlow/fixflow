class IotAlertPolicy < ApplicationPolicy
  def index?       = technician?
  def show?        = technician?
  def acknowledge? = manager?
  def resolve?     = manager?

  class Scope < ApplicationPolicy::Scope
    def resolve = scope.all
  end
end
