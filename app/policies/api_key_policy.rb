class ApiKeyPolicy < ApplicationPolicy
  def index?   = admin?
  def create?  = admin?
  def destroy? = admin?

  class Scope < ApplicationPolicy::Scope
    def resolve = scope.all
  end
end
