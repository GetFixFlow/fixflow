class MeterPolicy < ApplicationPolicy
  def index?   = technician?
  def show?    = technician?
  def create?  = manager?
  def update?  = manager?
  def destroy? = manager?
  # Anyone who works on the equipment can take a reading; a reset (the meter was replaced) is a manager's call.
  def record_reading? = technician?
  def reset?          = manager?

  class Scope < ApplicationPolicy::Scope
    def resolve = scope.all
  end
end
