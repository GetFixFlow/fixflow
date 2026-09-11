module Api
  module V1
    module Reports
      class WorkOrdersController < Reports::BaseController
        before_action :require_manager!, only: :technician_performance

        # GET /api/v1/reports/work_orders/summary
        def summary
          from, to = date_range
          scope    = base_wo_scope(from, to)

          completed   = scope.where(status: %w[completed verified])
          total_comp  = completed.count
          total_all   = scope.count

          overdue_comp = completed.where.not(due_date: nil).where("completed_at > due_date").count
          due_comp     = completed.where.not(due_date: nil).count
          overdue_rate = due_comp.positive? ? (overdue_comp.to_f / due_comp * 100).round(1) : 0

          first_fix    = total_comp.positive? ?
            (completed.where(rejection_reason: [nil, ""]).count.to_f / total_comp * 100).round(1) : 0

          avg_hours = completed.where.not(started_at: nil)
                               .average(Arel.sql("EXTRACT(EPOCH FROM (completed_at - created_at)) / 3600"))

          data = {
            period: { from: from.iso8601, to: to.iso8601, days: (to - from).to_i / 86400 },
            totals: {
              created:                total_all,
              completed:              total_comp,
              cancelled:              scope.where(status: "cancelled").count,
              avg_resolution_hours:   avg_hours&.round(1) || 0,
              overdue_rate:           overdue_rate,
              first_time_fix_rate:    first_fix
            },
            by_priority: by_priority_stats(scope),
            by_status:   scope.group(:status).count,
            trend:       trend_data(scope, from, to, group_by_param)
          }

          # Dispatch on the explicit `format` param rather than `respond_to`'s
          # Accept-header negotiation — ActionController::API doesn't register
          # a default format the way ActionController::Base does, so an
          # ordinary browser/axios Accept header (e.g. "application/json,
          # text/plain, */*") can raise ActionController::UnknownFormat.
          case params[:format]
          when "csv"
            require_export_permission!
            send_data ExportService.work_orders_csv(data[:trend]),
              filename: "work_orders_#{Date.today}.csv", type: "text/csv"
          when "pdf"
            require_export_permission!
            send_data PdfReportService.work_order_summary(data, org_name: current_organization.name),
              filename: "work_orders_#{Date.today}.pdf", type: "application/pdf"
          else
            render json: data
          end
        end

        # GET /api/v1/reports/work_orders/mttr
        def mttr
          from, to = date_range
          scope    = base_wo_scope(from, to)
                       .where(status: %w[completed verified])
                       .where.not(started_at: nil, completed_at: nil)
          overall  = scope.average(Arel.sql("EXTRACT(EPOCH FROM (completed_at - started_at)) / 3600"))

          group_by = params.fetch(:group_by, "asset")

          render json: {
            overall_mttr_hours: overall&.round(2) || 0,
            by_asset:           mttr_by_asset(scope),
            by_technician:      mttr_by_technician(scope),
            by_location:        mttr_by_location(scope)
          }
        end

        # GET /api/v1/reports/work_orders/backlog
        def backlog
          open_wo    = current_organization.work_orders.open.includes(:asset, :assignee)
          now        = Time.current
          buckets    = { "0_7_days" => [], "8_14_days" => [], "15_30_days" => [], "over_30_days" => [] }

          open_wo.each do |wo|
            age = (now - wo.created_at).to_i / 86400
            key = case age
                  when 0..7    then "0_7_days"
                  when 8..14   then "8_14_days"
                  when 15..30  then "15_30_days"
                  else              "over_30_days"
                  end
            buckets[key] << wo
          end

          aging_buckets = buckets.transform_values do |wos|
            { count: wos.size, critical: wos.count { |w| w.priority == "critical" } }
          end

          oldest = open_wo.order(created_at: :asc).limit(5)

          render json: {
            total_open:            open_wo.count,
            aging_buckets:         aging_buckets,
            oldest_work_orders:    WorkOrderBlueprint.render_as_hash(oldest, view: :extended)
          }
        end

        # GET /api/v1/reports/work_orders/technician_performance
        def technician_performance
          from, to = date_range
          users    = current_organization.users.where(role: %w[admin manager technician])
          users    = users.where(id: params[:user_id]) if params[:user_id].present?

          technicians = users.map do |user|
            wo         = current_organization.work_orders
                           .where(assignee_id: user.id, created_at: from..to)
            completed  = wo.where(status: %w[completed verified])
            total      = wo.count
            comp_count = completed.count
            on_time    = completed.where.not(due_date: nil)
                                  .where("completed_at <= due_date").count
            due_total  = completed.where.not(due_date: nil).count

            {
              user_id:               user.id,
              name:                  user.full_name,
              assigned:              total,
              completed:             comp_count,
              completion_rate:       total.positive? ? (comp_count.to_f / total * 100).round(1) : 0,
              avg_resolution_hours:  completed.where.not(started_at: nil)
                                              .average(Arel.sql("EXTRACT(EPOCH FROM (completed_at - started_at)) / 3600"))
                                              &.round(1) || 0,
              on_time_rate:          due_total.positive? ? (on_time.to_f / due_total * 100).round(1) : 0,
              first_time_fix_rate:   comp_count.positive? ?
                (completed.where(rejection_reason: [nil, ""]).count.to_f / comp_count * 100).round(1) : 0,
              critical_completed:    completed.where(priority: "critical").count
            }
          end

          render json: { technicians: technicians }
        end

        private

        def by_priority_stats(scope)
          WorkOrder::PRIORITIES.index_with do |priority|
            sub = scope.where(priority: priority)
            comp = sub.where(status: %w[completed verified]).where.not(started_at: nil)
            {
              created:   sub.count,
              completed: comp.count,
              avg_hours: comp.average(Arel.sql("EXTRACT(EPOCH FROM (completed_at - started_at)) / 3600"))
                            &.round(1) || 0
            }
          end
        end

        def mttr_by_asset(scope)
          scope.joins(:asset)
               .group("assets.id, assets.name, assets.asset_tag")
               .select(
                 "assets.id as asset_id, assets.name as asset_name, assets.asset_tag,
                  COUNT(*) as work_orders_count,
                  ROUND(AVG(EXTRACT(EPOCH FROM (completed_at - started_at)) / 3600)::numeric, 2) as avg_resolution_hours,
                  ROUND(MIN(EXTRACT(EPOCH FROM (completed_at - started_at)) / 3600)::numeric, 2) as min_hours,
                  ROUND(MAX(EXTRACT(EPOCH FROM (completed_at - started_at)) / 3600)::numeric, 2) as max_hours"
               ).map do |r|
            {
              asset_id: r.asset_id, asset_name: r.asset_name, asset_tag: r.asset_tag,
              work_orders_count: r.work_orders_count, avg_resolution_hours: r.avg_resolution_hours,
              min_hours: r.min_hours, max_hours: r.max_hours
            }
          end
        end

        def mttr_by_technician(scope)
          scope.where.not(assignee_id: nil)
               .joins("INNER JOIN users ON users.id = work_orders.assignee_id")
               .group("users.id, users.first_name, users.last_name")
               .select(
                 "users.id as user_id, users.first_name, users.last_name,
                  COUNT(*) as completed_count,
                  ROUND(AVG(EXTRACT(EPOCH FROM (completed_at - started_at)) / 3600)::numeric, 2) as avg_resolution_hours"
               ).map do |r|
            {
              user_id: r.user_id, name: "#{r.first_name} #{r.last_name}".strip,
              completed_count: r.completed_count, avg_resolution_hours: r.avg_resolution_hours
            }
          end
        end

        def mttr_by_location(scope)
          scope.joins(asset: :location)
               .group("locations.id, locations.name")
               .select(
                 "locations.name as location_name, COUNT(*) as work_orders_count,
                  ROUND(AVG(EXTRACT(EPOCH FROM (completed_at - started_at)) / 3600)::numeric, 2) as avg_resolution_hours"
               ).map do |r|
            { location: r.location_name, work_orders_count: r.work_orders_count,
              avg_resolution_hours: r.avg_resolution_hours }
          end
        end
      end
    end
  end
end
