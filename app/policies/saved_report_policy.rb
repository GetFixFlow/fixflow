class SavedReportPolicy < ApplicationPolicy
  # Reports show what work cost, so they are for managers and administrators; everyone of them sees the saved views
  # and can use them. Changing one is for whoever saved it, and administrators.
  def index?    = manager?
  def create?   = manager?
  def update?   = manager? && (admin? || record.user_id == user.id)
  def destroy?  = update?
  def send_now? = manager?

  class Scope < ApplicationPolicy::Scope
    def resolve = scope.all
  end
end
