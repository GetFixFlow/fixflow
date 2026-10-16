module Api
  module V1
    module Reports
      class WorkOrdersController < Reports::BaseController
        OPEN_STATUSES = %w[open assigned in_progress on_hold pending_parts].freeze
        FINISHED = %w[completed verified].freeze
        HEATMAP_WEEKS = 13
        # The age bands of the backlog chart, in whole days open.
        AGE_BUCKETS = { "0-7 days" => 0..7, "8-14 days" => 8..14, "15-30 days" => 15..30, "Over 30 days" => 31.. }.freeze
        OLDEST_SHOWN = 5
        REPAIR_HOURS_SQL = "EXTRACT(EPOCH FROM (work_orders.completed_at - work_orders.started_at)) / 3600".freeze

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
              avg_resolution_hours:   avg_hours.to_f.round(1),
              overdue_rate:           overdue_rate,
              first_time_fix_rate:    first_fix
            },
            by_priority: by_priority_stats(scope),
            by_priority_detail: by_priority_detail(scope),
            by_status:   scope.group(:status).count,
            trend:       trend_data(scope, from, to, group_by_param),
            completion_heatmap: completion_heatmap
          }

          # .csv lists the work orders behind the figures (same period and filters); .pdf is the summary.
          render_report(data, "work_orders",
                        csv: -> { ExportService.work_orders_csv(export_work_orders(scope)) },
                        pdf: -> { PdfReportService.work_order_summary(data, org_name: current_organization.name) })
        end

        # GET /api/v1/reports/work_orders/mttr  (the period and the Filters panel)
        # Mean time to repair: hours from the work starting to it being finished, for work orders created in the
        # period. `by_group` has the rows the chart draws for each way of grouping, slowest first.
        def mttr
          from, to = date_range
          scope    = base_wo_scope(from, to).where(status: FINISHED).where.not(started_at: nil).where.not(completed_at: nil)

          render json: {
            overall_avg: repair_hours.call(scope).to_f.round(1),
            by_group: {
              asset: mttr_rows(scope.joins(:asset), "assets.id", "assets.name"),
              location: mttr_rows(scope.joins(asset: :location), "locations.id", "locations.name"),
              technician: mttr_rows(scope.joins(:assignee), "users.id", "users.first_name || ' ' || users.last_name")
            }
          }
        end

        # GET /api/v1/reports/work_orders/backlog  (the Filters panel; the period does not matter: it is what is open now)
        def backlog
          open_wo = apply_report_filters(current_organization.work_orders.open)
          now = Time.current
          ages = open_wo.pluck(:created_at, :priority).map { |created, priority| [(now - created).to_i / 86_400, priority] }

          render json: {
            total_open: ages.size,
            aging: AGE_BUCKETS.map { |label, days| aging_row(label, ages.select { |age, _| days.cover?(age) }) },
            oldest_wos: open_wo.includes(:asset, :assignee).order(:created_at, :id).limit(OLDEST_SHOWN).map { |wo| oldest_row(wo, now) }
          }
        end

        # GET /api/v1/reports/work_orders/technician_performance
        def technician_performance
          from, to = date_range
          users    = current_organization.users.where(role: %w[admin manager technician])
          wanted   = id_list(:user_ids, :user_id, :assignee_id)
          users    = users.where(id: wanted) if wanted.any?

          technicians = users.map do |user|
            wo         = apply_report_filters(current_organization.work_orders)
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
              avg_resolution_hours:  repair_hours.call(completed.where.not(started_at: nil)).to_f.round(1),
              on_time_rate:          due_total.positive? ? (on_time.to_f / due_total * 100).round(1) : 0,
              first_time_fix_rate:   comp_count.positive? ?
                (completed.where(rejection_reason: [nil, ""]).count.to_f / comp_count * 100).round(1) : 0,
              critical_completed:    completed.where(priority: "critical").count
            }
          end

          render_report({ technicians: technicians }, "technician_performance",
                        csv: -> { ExportService.technician_performance_csv(technicians) })
        end

        private

        # The work orders an export holds, newest first. Cut at MAX_EXPORT_ROWS, and says so.
        def export_work_orders(scope)
          rows = scope.includes(:asset, :assignee).order(created_at: :desc, id: :desc).limit(MAX_EXPORT_ROWS + 1).to_a
          response.set_header("X-Export-Truncated", "true") if rows.size > MAX_EXPORT_ROWS
          rows.first(MAX_EXPORT_ROWS)
        end

        def by_priority_stats(scope)
          WorkOrder::PRIORITIES.index_with do |priority|
            sub = scope.where(priority: priority)
            comp = sub.where(status: %w[completed verified]).where.not(started_at: nil)
            {
              created:   sub.count,
              completed: comp.count,
              avg_hours: comp.average(Arel.sql("EXTRACT(EPOCH FROM (completed_at - started_at)) / 3600")).to_f.round(1)
            }
          end
        end

        # What the "By Priority" chart draws, one row for each priority: created in the period, how many of those are
        # finished and how many still open, the average hours from start to finish, and the share that missed their due
        # date (finished late, or still open and past it) of those that have one.
        def by_priority_detail(scope)
          WorkOrder::PRIORITIES.map do |priority|
            sub = scope.where(priority: priority)
            done = sub.where(status: FINISHED)
            hours = done.where.not(started_at: nil).average(Arel.sql("EXTRACT(EPOCH FROM (completed_at - started_at)) / 3600"))
            {
              priority: priority, created: sub.count, completed: done.count, open: sub.where(status: OPEN_STATUSES).count,
              avg_hours: hours.to_f.round(1), overdue_pct: overdue_percent(sub.where.not(due_date: nil))
            }
          end
        end

        # Of work orders that have a due date, the per cent that missed it: finished after it, or still open and past it.
        def overdue_percent(with_due)
          open_late = with_due.where(status: OPEN_STATUSES).where(due_date: ...Time.current).count
          finished = with_due.where(status: FINISHED)
          judged = finished.count + open_late
          return 0 if judged.zero?

          (((finished.where("completed_at > due_date").count + open_late).to_f / judged) * 100).round(1)
        end

        # Work orders finished on each of the last 13 weeks' days (the company's days), as { date, count }, only the days
        # that had any. It is a picture of recent activity, so it follows the Filters but not the period chosen.
        def completion_heatmap
          since = (Time.zone.today - ((HEATMAP_WEEKS * 7) - 1)).beginning_of_day
          rows = apply_report_filters(current_organization.work_orders)
                   .where(status: %w[completed verified], completed_at: since..)
                   .group(local_period_sql("work_orders.completed_at", "day")).count
          rows.sort_by { |date, _| date }.map { |date, count| { date: date, count: count } }
        end

        # The average hours from the work starting to it being finished (nil when there is nothing to average).
        def repair_hours
          ->(scope) { scope.average(Arel.sql(REPAIR_HOURS_SQL)) }
        end

        # One row for each asset (or place, or person): { name, avg_hours, wo_count, min_hours, max_hours }, slowest
        # first. `key` and `label` are our own column expressions, never anything from a request.
        def mttr_rows(scope, key, label)
          columns = [label, "COUNT(*)", "AVG(#{REPAIR_HOURS_SQL})", "MIN(#{REPAIR_HOURS_SQL})", "MAX(#{REPAIR_HOURS_SQL})"]
          rows = scope.group(Arel.sql(key), Arel.sql(label)).pluck(*columns.map { |column| Arel.sql(column) })
          rows = rows.map { |name, count, avg, min, max| mttr_row(name, count, avg, min, max) }
          rows.sort_by { |row| [-row[:avg_hours], row[:name]] }
        end

        def mttr_row(name, count, avg, min, max)
          {
            name: name.to_s.strip, wo_count: count, avg_hours: avg.to_f.round(1),
            min_hours: min.to_f.round(1), max_hours: max.to_f.round(1)
          }
        end

        # How many open work orders of each priority fall in one age band.
        def aging_row(label, ages)
          counts = ages.map(&:last).tally
          { bucket: label }.merge(WorkOrder::PRIORITIES.index_with { |priority| counts.fetch(priority, 0) })
        end

        def oldest_row(work_order, now)
          {
            id: work_order.id, work_order_number: work_order.work_order_number, title: work_order.title,
            asset_name: work_order.asset&.name, priority: work_order.priority, days_open: (now - work_order.created_at).to_i / 86_400,
            assignee_name: work_order.assignee&.full_name
          }
        end
      end
    end
  end
end
