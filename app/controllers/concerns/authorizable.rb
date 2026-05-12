module Authorizable
  extend ActiveSupport::Concern

  def require_admin!
    render json: { error: "Forbidden" }, status: :forbidden unless current_user&.admin?
  end

  def require_manager!
    render json: { error: "Forbidden" }, status: :forbidden unless current_user&.manager_or_above?
  end

  def require_technician_or_above!
    allowed = current_user&.role.in?(%w[admin manager technician])
    render json: { error: "Forbidden" }, status: :forbidden unless allowed
  end
end
