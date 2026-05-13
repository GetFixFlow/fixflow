class ReportPolicy < ApplicationPolicy
  def summary?                  = technician?
  def mttr?                     = manager?
  def backlog?                  = manager?
  def technician_performance?   = admin?
  def health?                   = technician?
  def history?                  = technician?
  def cost_analysis?            = manager?
  def compliance?               = manager?
  def schedule_forecast?        = technician?
  def alert_summary?            = manager?
  def sensor_trends?            = technician?
  def export_csv?               = manager?
  def export_pdf?               = manager?
end
