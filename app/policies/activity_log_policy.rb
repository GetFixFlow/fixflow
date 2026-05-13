class ActivityLogPolicy < ApplicationPolicy
  def index? = manager?

  class Scope < ApplicationPolicy::Scope
    def resolve = scope.all
  end
end
