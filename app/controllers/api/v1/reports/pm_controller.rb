module Api
  module V1
    module Reports
      class PmController < Reports::BaseController
        # How many of the best-known worst assets the report lists.
        WORST_ASSETS_SHOWN = 5

        # GET /api/v1/reports/pm/compliance  (the period and the Filters panel's assets and places)
        #
        # Compliance is the PM dashboard's: of the maintenance that came due in the period, the share completed.
        # Skipped maintenance and maintenance past its date and still not done ("missed") count against it;
        # maintenance not due yet is left out. With nothing due the rate is null ("no data"), not 0 or 100.
        def compliance
          from, to = date_range
          data = build_compliance_report(from, to)

          render_report(data, "pm_compliance",
                        csv: -> { ExportService.pm_compliance_csv(data[:by_month]) },
                        pdf: -> { PdfReportService.pm_compliance_report(data, org_name: current_organization.name) })
        end

        # GET /api/v1/reports/pm/schedule_forecast  (the Filters panel's assets, places and people)
        def schedule_forecast
          days  = [params.fetch(:days, 30).to_i, 90].min
          org   = current_organization

          scope = org.preventive_maintenances.status_active
                     .where(next_due_at: ..days.days.from_now)
          assignees = id_list(:user_ids, :assignee_id)
          scope = scope.where(assigned_to_id: assignees) if assignees.any?
          asset_ids = filtered_asset_ids
          scope = scope.where(asset_id: asset_ids) if asset_ids

          pms = scope.includes(:asset, :assigned_to).order(:next_due_at).to_a

          total_hours = pms.sum { |pm| pm.estimated_hours.to_f }

          by_week = pms.group_by { |pm| pm.next_due_at.beginning_of_week.to_date }
                       .map do |week_start, week_pms|
            {
              week_start:              week_start,
              total_estimated_hours:   week_pms.sum { |pm| pm.estimated_hours.to_f }.round(1),
              pms: week_pms.map { |pm| forecast_row(pm) }
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

        def forecast_row(schedule)
          {
            pm_id: schedule.id, name: schedule.name, priority: schedule.priority, asset: schedule.asset.name,
            due_date: schedule.next_due_at.to_date,
            frequency_type: schedule.frequency_type, frequency_value: schedule.frequency_value, frequency_unit: schedule.frequency_unit,
            estimated_hours: schedule.estimated_hours.to_f, assigned_to: schedule.assigned_to&.full_name
          }
        end

        def build_compliance_report(from, to)
          base = PmExecution.joins(:preventive_maintenance)
                            .where(preventive_maintenances: { organization_id: current_organization.id })
                            .where(scheduled_date: from.to_date..to.to_date)
          asset_ids = filtered_asset_ids
          base = base.where(preventive_maintenances: { asset_id: asset_ids }) if asset_ids

          overall = overall_tally(base)
          {
            overall_compliance_rate: compliance_rate(overall),
            period: { from: from.to_date.to_s, to: to.to_date.to_s },
            summary: {
              scheduled: scheduled(overall), completed: overall[:completed], skipped: overall[:skipped], missed: overall[:missed]
            },
            by_month: by_month(base),
            by_location: by_location(base),
            worst_performing_assets: worst_assets(base)
          }
        end

        def by_month(base)
          tallies(base, "TO_CHAR(pm_executions.scheduled_date, 'YYYY-MM')").sort.map do |month, tally|
            { month: month, scheduled: scheduled(tally), completed: tally[:completed], skipped: tally[:skipped],
              missed: tally[:missed], compliance_rate: compliance_rate(tally) }
          end
        end

        def by_location(base)
          rows = tallies(base.joins(preventive_maintenance: { asset: :location }), "locations.name").map do |name, tally|
            { location: name, scheduled: scheduled(tally), completed: tally[:completed], skipped: tally[:skipped],
              missed: tally[:missed], compliance_rate: compliance_rate(tally) }
          end
          rows.sort_by { |row| worst_first(row[:compliance_rate], row[:location]) }
        end

        # The assets with the lowest compliance (only those with maintenance that came due).
        def worst_assets(base)
          rows = tallies(base.joins(preventive_maintenance: :asset), "assets.name").filter_map do |name, tally|
            due = due_count(tally)
            next if due.zero?

            { asset_name: name, total: due, completed: tally[:completed], missed: due - tally[:completed],
              compliance_rate: compliance_rate(tally) }
          end
          rows.sort_by { |row| worst_first(row[:compliance_rate], row[:asset_name]) }.first(WORST_ASSETS_SHOWN)
        end

        def worst_first(rate, name) = [rate.nil? ? 1 : 0, rate || 0, name.to_s]

        # { key => { completed:, skipped:, missed:, upcoming: } } counted by `key` (our own SQL expression). An execution
        # is completed, skipped, missed (not done and past its date) or upcoming (not done and not yet due).
        def tallies(scope, key)
          counts = scope.group(Arel.sql(key), outcome_sql).count
          counts.each_with_object(Hash.new { |hash, key_name| hash[key_name] = empty_tally }) do |((name, outcome), count), hash|
            hash[name][outcome.to_sym] += count
          end
        end

        def overall_tally(scope)
          scope.group(outcome_sql).count.each_with_object(empty_tally) { |(outcome, count), tally| tally[outcome.to_sym] += count }
        end

        def empty_tally = { completed: 0, skipped: 0, missed: 0, upcoming: 0 }

        def outcome_sql
          statuses = PmExecution.statuses
          today = ActiveRecord::Base.connection.quote(Date.current)
          Arel.sql("CASE WHEN pm_executions.status = #{statuses.fetch('completed')} THEN 'completed' " \
                   "WHEN pm_executions.status = #{statuses.fetch('skipped')} THEN 'skipped' " \
                   "WHEN pm_executions.scheduled_date < #{today} THEN 'missed' ELSE 'upcoming' END")
        end

        def scheduled(tally) = tally.values.sum
        def due_count(tally) = tally[:completed] + tally[:skipped] + tally[:missed]

        def compliance_rate(tally)
          due = due_count(tally)
          due.zero? ? nil : ((tally[:completed].to_f / due) * 100).round(1)
        end
      end
    end
  end
end
