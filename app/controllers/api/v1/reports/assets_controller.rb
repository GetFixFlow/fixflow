module Api
  module V1
    module Reports
      class AssetsController < Reports::BaseController
        # GET /api/v1/reports/assets/health
        def health
          cache_key = "reports/asset_health/#{current_organization.id}"
          data = Rails.cache.fetch(cache_key, expires_in: 10.minutes) do
            build_health_report
          end

          respond_to do |format|
            format.json { render json: data }
            format.csv do
              require_export_permission!
              send_data ExportService.assets_csv(data[:by_location]),
                filename: "asset_health_#{Date.today}.csv", type: "text/csv"
            end
            format.pdf do
              require_export_permission!
              send_data PdfReportService.asset_health_report(data, org_name: current_organization.name),
                filename: "asset_health_#{Date.today}.pdf", type: "application/pdf"
            end
          end
        end

        # GET /api/v1/reports/assets/:id/history
        def history
          asset = current_organization.assets.find(params[:id])
          from, to = begin
            date_range
          rescue ActionController::BadRequest
            [5.years.ago, Time.current]
          end

          type_filter = params[:type]

          wo_events  = build_wo_events(asset, from, to)
          pm_events  = build_pm_events(asset, from, to)
          alt_events = build_alert_events(asset, from, to)

          all_events = []
          all_events += wo_events   unless type_filter.present? && type_filter != "work_order"
          all_events += pm_events   unless type_filter.present? && type_filter != "pm"
          all_events += alt_events  unless type_filter.present? && type_filter != "iot_alert"
          timeline = all_events.sort_by { |e| e[:date] }.reverse

          completed_wo = asset.work_orders.where(status: %w[completed verified])
          downtime = completed_wo.where.not(started_at: nil)
                                 .sum(Arel.sql("EXTRACT(EPOCH FROM (completed_at - started_at)) / 3600"))

          render json: {
            asset:   { id: asset.id, name: asset.name, tag: asset.asset_tag },
            summary: {
              total_work_orders:     asset.work_orders.count,
              total_downtime_hours:  downtime.round(1),
              total_maintenance_cost: asset.work_orders.sum("labor_cost + parts_cost").round(2),
              pm_compliance_rate:    pm_compliance_for_asset(asset),
              iot_alerts_total:      asset.iot_alerts.count
            },
            timeline: timeline
          }
        end

        # GET /api/v1/reports/assets/cost_analysis
        def cost_analysis
          from, to = date_range
          org = current_organization

          scope = org.assets.kept
          scope = scope.where(location_id: Location.find(params[:location_id]).subtree_ids) if params[:location_id].present?

          by_asset = scope.left_joins(:work_orders)
            .where(work_orders: { id: nil }).or(
              scope.left_joins(:work_orders)
                   .where(work_orders: { created_at: from..to })
            )
            .group("assets.id, assets.name, assets.asset_tag")
            .select(
              "assets.id as asset_id, assets.name as asset_name, assets.asset_tag,
               COUNT(work_orders.id)                        as work_orders_count,
               COALESCE(SUM(work_orders.labor_cost), 0)     as labor_cost,
               COALESCE(SUM(work_orders.parts_cost), 0)     as parts_cost,
               COALESCE(SUM(work_orders.labor_cost + work_orders.parts_cost), 0) as total_cost"
            )

          sort_col = { "labor" => "labor_cost", "parts" => "parts_cost" }
                       .fetch(params[:sort_by], "total_cost")
          by_asset = by_asset.order(Arel.sql("#{sort_col} DESC"))

          rows = by_asset.map do |r|
            {
              asset_id:    r.asset_id,
              asset_name:  r.asset_name,
              work_orders: r.work_orders_count.to_i,
              labor_cost:  r.labor_cost.to_f.round(2),
              parts_cost:  r.parts_cost.to_f.round(2),
              total_cost:  r.total_cost.to_f.round(2),
              cost_per_wo: r.work_orders_count.to_i.positive? ?
                (r.total_cost.to_f / r.work_orders_count).round(2) : 0
            }
          end

          totals = rows.each_with_object({ total_cost: 0, total_labor_cost: 0, total_parts_cost: 0 }) do |r, h|
            h[:total_cost]       += r[:total_cost]
            h[:total_labor_cost] += r[:labor_cost]
            h[:total_parts_cost] += r[:parts_cost]
          end

          render json: totals.merge(by_asset: rows)
        end

        private

        def build_health_report
          org    = current_organization
          assets = org.assets.kept
          assets = assets.where(status: params[:status]) if params[:status].present?
          if params[:location_id].present?
            assets = assets.where(location_id: Location.find(params[:location_id]).subtree_ids)
          end

          total = assets.count
          op    = assets.where(status: "operational").count
          deg   = assets.where(status: "degraded").count

          by_location = assets.left_joins(:location)
            .group("COALESCE(locations.name, 'Unassigned')")
            .select(
              "COALESCE(locations.name, 'Unassigned') as loc_name,
               COUNT(*) as total_count,
               SUM(CASE WHEN assets.status = 'operational' THEN 1 ELSE 0 END) as op_count,
               SUM(CASE WHEN assets.status = 'degraded'    THEN 1 ELSE 0 END) as deg_count,
               SUM(CASE WHEN assets.status = 'down'        THEN 1 ELSE 0 END) as down_count"
            ).map do |r|
            t = r.total_count.to_i
            hs = t.positive? ? (((r.op_count.to_i + r.deg_count.to_i).to_f / t) * 100).round(1) : 0
            { location: r.loc_name, total: t, operational: r.op_count.to_i,
              degraded: r.deg_count.to_i, down: r.down_count.to_i, health_score: hs }
          end

          recently_degraded = assets.where(status: %w[degraded down])
                                    .order(updated_at: :desc).limit(10).map do |a|
            { id: a.id, name: a.name, asset_tag: a.asset_tag, status: a.status }
          end

          most_maintained = org.assets.kept
            .joins(:work_orders)
            .where(work_orders: { created_at: 90.days.ago.. })
            .group("assets.id, assets.name, assets.asset_tag")
            .order(Arel.sql("COUNT(work_orders.id) DESC"))
            .limit(5)
            .select("assets.id, assets.name, assets.asset_tag, COUNT(work_orders.id) as wo_count")
            .map { |a| { id: a.id, name: a.name, asset_tag: a.asset_tag, work_order_count: a.wo_count.to_i } }

          {
            health_score:       total.positive? ? ((op + deg).to_f / total * 100).round(1) : 0,
            total:              total,
            by_status:          { operational: op, degraded: deg,
                                  down: assets.where(status: "down").count,
                                  decommissioned: assets.where(status: "decommissioned").count },
            by_location:        by_location,
            recently_degraded:  recently_degraded,
            most_maintained:    most_maintained
          }
        end

        def build_wo_events(asset, from, to)
          asset.work_orders.where(created_at: from..to).includes(:assignee).map do |wo|
            {
              date:        (wo.completed_at || wo.created_at).to_date,
              type:        "work_order",
              title:       "#{wo.work_order_number} #{wo.title}",
              status:      wo.status,
              hours:       wo.actual_hours || 0,
              technician:  wo.assignee&.full_name
            }
          end
        end

        def build_pm_events(asset, from, to)
          PmExecution.joins(:preventive_maintenance)
            .where(preventive_maintenances: { asset_id: asset.id })
            .where(scheduled_date: from.to_date..to.to_date)
            .includes(:preventive_maintenance).map do |ex|
            {
              date:   ex.scheduled_date,
              type:   "pm",
              title:  ex.preventive_maintenance.name,
              status: ex.status
            }
          end
        end

        def build_alert_events(asset, from, to)
          asset.iot_alerts.where(created_at: from..to).map do |alert|
            {
              date:   alert.created_at.to_date,
              type:   "iot_alert",
              title:  "#{alert.metric_name} Alert (#{alert.triggered_value} — threshold #{alert.threshold})",
              status: alert.status
            }
          end
        end

        def pm_compliance_for_asset(asset)
          ex = PmExecution.joins(:preventive_maintenance)
                          .where(preventive_maintenances: { asset_id: asset.id })
                          .where.not(status: 0)  # exclude pending
          actionable = ex.where(status: [2, 3]).count
          completed  = ex.where(status: 3).count
          actionable.positive? ? (completed.to_f / actionable * 100).round(1) : 0
        end
      end
    end
  end
end
