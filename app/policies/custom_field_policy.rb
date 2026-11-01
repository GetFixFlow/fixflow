class CustomFieldPolicy < ApplicationPolicy
  # Everyone who fills in or reads a work order or a part needs to know the fields; an administrator defines them.
  def index?   = true
  def create?  = admin?
  def update?  = admin?
  def reorder? = admin?
  def destroy? = admin?

  class Scope < ApplicationPolicy::Scope
    def resolve = scope.all
  end
end
