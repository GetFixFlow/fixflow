class PartPolicy < ApplicationPolicy
  def index?        = technician?
  def show?         = technician?
  def create?       = manager?
  def update?       = manager?
  def destroy?      = admin?
  def adjust_stock? = technician?
  def low_stock?    = manager?

  class Scope < ApplicationPolicy::Scope
    def resolve = scope.all
  end
end
