class IotRulePolicy < ApplicationPolicy
  def index?   = manager?
  def show?    = manager?
  def create?  = manager?
  def update?  = manager?
  def destroy? = admin?
  def pause?   = manager?
  def resume?  = manager?
  def test?    = manager?

  class Scope < ApplicationPolicy::Scope
    def resolve = scope.all
  end
end
