module Api
  module V1
    module Reports
      class AssetsController < Reports::BaseController
        # The most assets the inventory table lists. `total` says how many there are.
        INVENTORY_LIMIT = 500
        MONTHS_SHOWN = 12

        # GET /api/v1/reports/assets/health  (a status, and the Filters panel's assets and places)
        def health
          data = build_health_report

          render_report(data, "asset_health",
                        csv: -> { ExportService.asset_health_csv(data[:by_location]) },
                        pdf: -> { PdfReportService.asset_health_report(data, org_name: current_organization.name) })
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

          repaired = asset.work_orders.where(status: %w[completed verified]).where.not(started_at: nil)
          repair_hours = Arel.sql("EXTRACT(EPOCH FROM (completed_at - started_at)) / 3600")

          render json: {
            asset:   { id: asset.id, name: asset.name, tag: asset.asset_tag },
            summary: {
              total_work_orders:     asset.work_orders.count,
              total_downtime_hours:  repaired.sum(repair_hours).to_f.round(1),
              avg_resolution_hours:  repaired.average(repair_hours).to_f.round(1),
              total_maintenance_cost: asset.work_orders.sum("labor_cost + parts_cost + vendor_cost").to_f.round(2),
              pm_compliance_rate:    pm_compliance_for_asset(asset),
              iot_alerts_total:      asset.iot_alerts.count
            },
            monthly: monthly_activity(asset),
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
               COALESCE(SUM(work_orders.vendor_cost), 0)    as vendor_cost,
               COALESCE(SUM(work_orders.labor_cost + work_orders.parts_cost + work_orders.vendor_cost), 0) as total_cost"
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
              vendor_cost: r.vendor_cost.to_f.round(2),
              total_cost:  r.total_cost.to_f.round(2),
              cost_per_wo: r.work_orders_count.to_i.positive? ?
                (r.total_cost.to_f / r.work_orders_count).round(2) : 0
            }
          end

          totals = rows.each_with_object({ total_cost: 0, total_labor_cost: 0, total_parts_cost: 0, total_vendor_cost: 0 }) do |r, h|
            h[:total_cost]       += r[:total_cost]
            h[:total_labor_cost] += r[:labor_cost]
            h[:total_parts_cost] += r[:parts_cost]
            h[:total_vendor_cost] += r[:vendor_cost]
          end

          render json: totals.merge(by_asset: rows)
        end

        private

        def build_health_report
          org    = current_organization
          assets = org.assets.kept
          assets = assets.where(status: params[:status]) if params[:status].present?
          wanted = filtered_asset_ids
          assets = assets.where(id: wanted) if wanted

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

          most_maintained = assets
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
            most_maintained:    most_maintained,
            assets:             inventory(assets)
          }
        end

        # What the inventory table lists: each asset with its status and how much work and alerting it has had (all
        # time; `sensor_alerts` is the alerts still open). Those that need attention come first.
        def inventory(assets)
          rows = assets.includes(:location)
                       .order(Arel.sql("CASE assets.status WHEN 'down' THEN 0 WHEN 'degraded' THEN 1 ELSE 2 END"), :name, :id)
                       .limit(INVENTORY_LIMIT).to_a
          ids = rows.map(&:id)
          work = WorkOrder.where(asset_id: ids)
          totals = work.group(:asset_id).count
          open_counts = work.open.group(:asset_id).count
          alerts = IotAlert.where(asset_id: ids, status: :open).group(:asset_id).count
          rows.map do |asset|
            {
              id: asset.id, name: asset.name, asset_tag: asset.asset_tag, status: asset.status, location: asset.location&.name,
              open_work_orders: open_counts.fetch(asset.id, 0), total_work_orders: totals.fetch(asset.id, 0),
              sensor_alerts: alerts.fetch(asset.id, 0)
            }
          end
        end

        # One row for each of the last 12 months (the company's months, this one last, none left out): work orders
        # made by a schedule (`pm`), other work orders (`corrective`) and IoT alerts raised (`iot`).
        def monthly_activity(asset)
          first = Time.zone.today.beginning_of_month.prev_month(MONTHS_SHOWN - 1)
          since = first.beginning_of_day
          created = asset.work_orders.where(created_at: since..)
          by_month = ->(scope, column) { scope.group(local_period_sql(column, "month")).count }
          pm = by_month.call(created.where.not(preventive_maintenance_id: nil), "work_orders.created_at")
          corrective = by_month.call(created.where(preventive_maintenance_id: nil), "work_orders.created_at")
          iot = by_month.call(asset.iot_alerts.where(created_at: since..), "iot_alerts.created_at")
          Array.new(MONTHS_SHOWN) { |n| first.next_month(n) }.map do |date|
            { month: date.iso8601, corrective: corrective.fetch(date, 0), pm: pm.fetch(date, 0), iot: iot.fetch(date, 0) }
          end
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
