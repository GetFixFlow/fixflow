class AssetDocumentPolicy < ApplicationPolicy
  def index?  = technician?
  def create? = technician?
  # The person who added it, or a manager.
  def destroy? = manager? || record.user_id == user.id

  class Scope < ApplicationPolicy::Scope
    def resolve = scope.all
  end
end
