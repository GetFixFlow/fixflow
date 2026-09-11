module Api
  module V1
    module Reports
      class PmController < Reports::BaseController
        # GET /api/v1/reports/pm/compliance
        def compliance
          from, to = date_range
          org      = current_organization
          cache_key = "reports/pm_compliance/#{org.id}/#{from.to_date}/#{to.to_date}"

          data = Rails.cache.fetch(cache_key, expires_in: 15.minutes) do
            build_compliance_report(org, from, to)
          end

          # Dispatch on the explicit `format` param — see note in
          # Reports::WorkOrdersController#summary.
          case params[:format]
          when "csv"
            require_export_permission!
            send_data ExportService.pm_compliance_csv(data[:by_month]),
              filename: "pm_compliance_#{Date.today}.csv", type: "text/csv"
          when "pdf"
            require_export_permission!
            send_data PdfReportService.pm_compliance_report(data, org_name: org.name),
              filename: "pm_compliance_#{Date.today}.pdf", type: "application/pdf"
          else
            render json: data
          end
        end

        # GET /api/v1/reports/pm/schedule_forecast
        def schedule_forecast
          days  = [params.fetch(:days, 30).to_i, 90].min
          org   = current_organization

          scope = org.preventive_maintenances.status_active
                     .where(next_due_at: ..days.days.from_now)
          scope = scope.where(assigned_to_id: params[:assignee_id]) if params[:assignee_id].present?
          if params[:location_id].present?
            asset_ids = org.assets.where(location_id: Location.find(params[:location_id]).subtree_ids).kept.pluck(:id)
            scope = scope.where(asset_id: asset_ids)
          end

          pms = scope.includes(:asset, :assigned_to).order(:next_due_at).to_a

          total_hours = pms.sum { |pm| pm.estimated_hours.to_f }

          by_week = pms.group_by { |pm| pm.next_due_at.beginning_of_week.to_date }
                       .map do |week_start, week_pms|
            {
              week_start:              week_start,
              total_estimated_hours:   week_pms.sum { |pm| pm.estimated_hours.to_f }.round(1),
              pms: week_pms.map { |pm|
                {
                  pm_id:             pm.id,
                  name:              pm.name,
                  asset:             pm.asset.name,
                  due_date:          pm.next_due_at&.to_date,
                  estimated_hours:   pm.estimated_hours.to_f,
                  assigned_to:       pm.assigned_to&.full_name
                }
              }
            }
          end

          render json: {
            forecast_days:    days,
            total_upcoming:   pms.size,
            estimated_hours:  total_hours.round(1),
            by_week:          by_week
          }
        end

        private

        def build_compliance_report(org, from, to)
          base = PmExecution.joins(:preventive_maintenance)
                            .where(preventive_maintenances: { organization_id: org.id })
                            .where(scheduled_date: from.to_date..to.to_date)

          if params[:location_id].present?
            asset_ids = org.assets.where(location_id: Location.find(params[:location_id]).subtree_ids).kept.pluck(:id)
            base = base.where(preventive_maintenances: { asset_id: asset_ids })
          end

          scheduled  = base.count
          completed  = base.where(status: 3).count   # completed
          skipped    = base.where(status: 2).count   # skipped
          overdue    = base.where(status: [0, 1]).where("scheduled_date < ?", Date.today).count
          actionable = completed + skipped
          rate       = actionable.positive? ? (completed.to_f / actionable * 100).round(1) : 0

          # Monthly breakdown
          by_month = base.group(Arel.sql("TO_CHAR(scheduled_date, 'YYYY-MM')"))
                         .group(:status)
                         .count
                         .each_with_object({}) do |((month, status), count), h|
            h[month] ||= { month: month, scheduled: 0, completed: 0, skipped: 0 }
            h[month][:scheduled] += count
            h[month][:completed] += count if status == 3
            h[month][:skipped]   += count if status == 2
          end
                         .values
                         .sort_by { |m| m[:month] }
                         .map { |m|
                           act = m[:completed] + m[:skipped]
                           m.merge(compliance_rate: act.positive? ? (m[:completed].to_f / act * 100).round(1) : 0)
                         }

          # By location
          by_location = PmExecution.joins(preventive_maintenance: { asset: :location })
            .where(preventive_maintenances: { organization_id: org.id })
            .where(scheduled_date: from.to_date..to.to_date)
            .group("locations.name")
            .group(:status)
            .count
            .each_with_object({}) do |((loc, status), count), h|
              h[loc] ||= { location: loc, scheduled: 0, completed: 0 }
              h[loc][:scheduled] += count
              h[loc][:completed] += count if status == 3
            end
            .values
            .map { |l| l.merge(compliance_rate: l[:scheduled].positive? ? (l[:completed].to_f / l[:scheduled] * 100).round(1) : 0) }
            .sort_by { |l| l[:compliance_rate] }

          # Worst performing assets
          worst = PmExecution.joins(preventive_maintenance: :asset)
            .where(preventive_maintenances: { organization_id: org.id })
            .where(scheduled_date: from.to_date..to.to_date)
            .where(status: [2, 3])
            .group("assets.name")
            .group(:status)
            .count
            .each_with_object({}) do |((asset_name, status), count), h|
              h[asset_name] ||= { asset_name: asset_name, total: 0, completed: 0 }
              h[asset_name][:total]     += count
              h[asset_name][:completed] += count if status == 3
            end
            .values
            .map { |a| a.merge(compliance_rate: (a[:completed].to_f / a[:total] * 100).round(1), missed: a[:total] - a[:completed]) }
            .sort_by { |a| a[:compliance_rate] }
            .first(5)

          {
            overall_compliance_rate: rate,
            period: { from: from.to_date.to_s, to: to.to_date.to_s },
            summary: { scheduled: scheduled, completed: completed, skipped: skipped, overdue: overdue },
            by_month:                by_month,
            by_location:             by_location,
            worst_performing_assets: worst
          }
        end
      end
    end
  end
end
