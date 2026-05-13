module Api
  module V1
    class DashboardController < Api::V1::BaseController
      def index
        cache_key = "dashboard/#{current_organization.id}/#{current_user.role}/#{current_user.id}"
        data = Rails.cache.fetch(cache_key, expires_in: 5.minutes) { build_dashboard }
        render json: data
      end

      private

      def build_dashboard
        case current_user.role
        when "admin", "manager" then full_dashboard
        when "technician"        then technician_dashboard
        else                          requester_dashboard
        end
      end

      # ── Full dashboard (admin / manager) ─────────────────────────────────

      def full_dashboard
        org = current_organization
        {
          work_orders:            work_order_stats(org),
          assets:                 asset_stats(org),
          preventive_maintenance: pm_stats(org),
          iot:                    iot_stats(org),
          recent_activity:        recent_activity(org),
          generated_at:           Time.current
        }
      end

      def work_order_stats(org)
        wo        = org.work_orders
        open_st   = %w[open assigned in_progress on_hold pending_parts]
        completed = wo.where(status: %w[completed verified])
        avg_hours = wo.where.not(started_at: nil, completed_at: nil)
                      .average(Arel.sql("EXTRACT(EPOCH FROM (completed_at - started_at)) / 3600"))

        {
          open:                   wo.where(status: "open").count,
          in_progress:            wo.where(status: "in_progress").count,
          overdue:                wo.overdue.count,
          completed_today:        completed.where(completed_at: Time.current.all_day).count,
          completed_this_week:    completed.where(completed_at: 1.week.ago..).count,
          critical_open:          wo.where(status: open_st, priority: "critical").count,
          avg_resolution_hours:   avg_hours&.round(1) || 0
        }
      end

      def asset_stats(org)
        assets = org.assets.kept
        total  = assets.count
        op     = assets.where(status: "operational").count
        deg    = assets.where(status: "degraded").count

        {
          total:            total,
          operational:      op,
          degraded:         deg,
          down:             assets.where(status: "down").count,
          decommissioned:   assets.where(status: "decommissioned").count,
          health_score:     total.positive? ? ((op + deg).to_f / total * 100).round(1) : 0
        }
      end

      def pm_stats(org)
        pms        = org.preventive_maintenances.status_active
        executions = PmExecution.joins(:preventive_maintenance)
                                .where(preventive_maintenances: { organization_id: org.id })
                                .where(scheduled_date: 30.days.ago..Date.today)
        actionable = executions.where(status: %w[2 3]).count  # skipped=2, completed=3
        completed  = executions.where(status: 3).count
        rate       = actionable.positive? ? (completed.to_f / actionable * 100).round(1) : 0

        next_due = pms.where.not(next_due_at: nil).order(:next_due_at).limit(3)
                      .includes(:asset).map do |pm|
          { id: pm.id, name: pm.name, asset: pm.asset.name, due_date: pm.next_due_at.to_date }
        end

        {
          due_this_week:       pms.due_within(7).count,
          overdue:             pms.overdue.count,
          compliance_rate_30d: rate,
          next_due:            next_due
        }
      end

      def iot_stats(org)
        alerts = IotAlert.joins(:asset).where(assets: { organization_id: org.id })

        {
          active_rules:       org.iot_rules.where(status: :active).count,
          open_alerts:        alerts.where(status: :open).count,
          critical_alerts:    alerts.where(status: :open)
                                    .joins(:iot_rule).where(iot_rules: { wo_priority: 0 }).count,
          readings_last_hour: SensorReading.where(organization_id: org.id)
                                           .where(received_at: 1.hour.ago..).count
        }
      end

      def recent_activity(org)
        ActivityLog.where(organization_id: org.id).recent.limit(10).map do |log|
          {
            type:        log.action,
            description: log.resource_name,
            user:        log.user&.full_name,
            timestamp:   log.created_at
          }
        end
      end

      # ── Technician dashboard ──────────────────────────────────────────────

      def technician_dashboard
        org  = current_organization
        uid  = current_user.id
        wo   = org.work_orders.where(assignee_id: uid)

        {
          my_work_orders: {
            assigned:         wo.where(status: "assigned").count,
            in_progress:      wo.where(status: "in_progress").count,
            overdue:          wo.overdue.count,
            completed_today:  wo.where(status: %w[completed verified],
                                       completed_at: Time.current.all_day).count
          },
          upcoming_pms: org.preventive_maintenances.status_active
                           .where(assigned_to_id: uid).order(:next_due_at).limit(5)
                           .includes(:asset).map { |pm|
            { id: pm.id, name: pm.name, asset: pm.asset.name, due_date: pm.next_due_at&.to_date }
          },
          recent_activity: ActivityLog.where(organization_id: org.id, user_id: uid)
                                      .recent.limit(10).map { |log|
            { type: log.action, description: log.resource_name, timestamp: log.created_at }
          }
        }
      end

      # ── Requester dashboard ───────────────────────────────────────────────

      def requester_dashboard
        wo = current_organization.work_orders.where(requester_id: current_user.id)
        {
          my_requests: {
            total:     wo.count,
            open:      wo.where(status: %w[open assigned in_progress on_hold pending_parts]).count,
            completed: wo.where(status: %w[completed verified]).count
          }
        }
      end
    end
  end
end
