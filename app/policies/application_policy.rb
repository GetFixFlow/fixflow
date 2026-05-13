class ApplicationPolicy
  attr_reader :user, :record

  def initialize(user, record)
    @user   = user
    @record = record
  end

  def index?   = false
  def show?    = false
  def create?  = false
  def update?  = false
  def destroy? = false

  # ── Role helpers ─────────────────────────────────────────────────────────

  def admin?
    user.admin?
  end

  def manager?
    user.manager? || admin?
  end

  def technician?
    user.technician? || manager?
  end

  def requester?
    user.requester? || technician?
  end

  class Scope
    def initialize(user, scope)
      @user  = user
      @scope = scope
    end

    def resolve
      @scope.all
    end

    private

    attr_reader :user, :scope
  end
end
