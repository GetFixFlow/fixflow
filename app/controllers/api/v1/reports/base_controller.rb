module Api
  module V1
    module Reports
      class BaseController < Api::V1::BaseController
        VALID_GROUP_BY = %w[day week month].freeze
        # The most work orders one export holds. A bigger result is cut here and says so (X-Export-Truncated).
        MAX_EXPORT_ROWS = 50_000
        # A date on its own, like 2026-10-16, as the screens send it.
        DATE_ONLY = /\A\d{4}-\d{2}-\d{2}\z/
        SOURCES = %w[manual pm iot].freeze

        # Where a work order came from: a schedule, an IoT rule, or made by hand.
        SOURCE_CONDITIONS = {
          "pm" => "work_orders.preventive_maintenance_id IS NOT NULL",
          "iot" => "(work_orders.iot_rule_id IS NOT NULL OR work_orders.iot_alert_id IS NOT NULL)",
          "manual" => "(work_orders.preventive_maintenance_id IS NULL AND " \
                      "work_orders.iot_rule_id IS NULL AND work_orders.iot_alert_id IS NULL)"
        }.freeze

        # Reports show costs, and what work cost in wages reveals what people are paid, so they are for
        # managers and administrators (as the screens already were).
        before_action :require_manager!

        private

        # Returns [from, to] Time objects, defaulting to last 30 days. A date on its own (what the screens send)
        # means the whole day: from is the start of it, to is the end of it, so today's work is in the report.
        def date_range
          from = params[:from].present? ? Time.zone.parse(params[:from]) : 30.days.ago.beginning_of_day
          to   = params[:to].present?   ? end_of_day_if_date(params[:to]) : Time.current.end_of_day

          raise ArgumentError, "from must be before to" if from >= to
          [from, to]
        rescue ArgumentError => e
          raise ActionController::BadRequest, e.message
        end

        def end_of_day_if_date(text)
          time = Time.zone.parse(text)
          text.to_s.match?(DATE_ONLY) ? time&.end_of_day : time
        end

        def group_by_param
          param = params.fetch(:group_by, "day")
          VALID_GROUP_BY.include?(param) ? param : "day"
        end

        def asset_ids_for_location(location_id)
          location = current_organization.locations.find(location_id)
          current_organization.assets.where(location_id: location.subtree_ids).kept.pluck(:id)
        end

        def base_wo_scope(from, to)
          apply_report_filters(current_organization.work_orders.where(created_at: from..to))
        end

        # The Filters panel sends lists (location_ids[], asset_ids[], user_ids[], priorities[], sources[]);
        # the single values older callers send (location_id, asset_id, assignee_id) work too.
        def apply_report_filters(scope)
          asset_ids = filtered_asset_ids
          scope = scope.where(asset_id: asset_ids) if asset_ids
          assignees = id_list(:user_ids, :assignee_id)
          scope = scope.where(assignee_id: assignees) if assignees.any?
          priorities = list(:priorities) & WorkOrder::PRIORITIES
          scope = scope.where(priority: priorities) if list(:priorities).any?
          list(:sources).any? ? filter_by_source(scope, list(:sources) & SOURCES) : scope
        end

        def list(*names)
          names.flat_map { |name| Array(params[name]) }.compact_blank.map(&:to_s)
        end

        def id_list(*names)
          list(*names).filter_map { |value| Integer(value, exception: false) }
        end

        # nil when no asset or place was asked for. Places include everything inside them.
        def filtered_asset_ids
          wanted_assets = id_list(:asset_ids, :asset_id)
          wanted_places = id_list(:location_ids, :location_id)
          return if wanted_assets.empty? && wanted_places.empty?

          ids = current_organization.assets.kept
          ids = ids.where(id: wanted_assets) if wanted_assets.any?
          if wanted_places.any?
            places = current_organization.locations.where(id: wanted_places).flat_map(&:subtree_ids)
            ids = ids.where(location_id: places)
          end
          ids.pluck(:id)
        end

        # A work order came from a schedule, from an IoT rule, or was made by hand.
        def filter_by_source(scope, sources)
          conditions = SOURCE_CONDITIONS.values_at(*sources).compact
          conditions.empty? ? scope.none : scope.where(conditions.join(" OR "))
        end

        # One point for each day, week or month in which something was created or completed:
        # { date, created, completed, resolution_hours }. `resolution_hours` is the average time from creation to
        # completion of the work orders completed in that period (0 when none were). Days are the company's.
        def trend_data(scope, _from, _to, group_by)
          unit = %w[week month].include?(group_by) ? group_by : "day"
          created = scope.group(local_period_sql("work_orders.created_at", unit)).count
          done = scope.where(status: %w[completed verified]).where.not(completed_at: nil)
          completed = done.group(local_period_sql("work_orders.completed_at", unit)).count
          hours = done.group(local_period_sql("work_orders.completed_at", unit))
                      .average(Arel.sql("EXTRACT(EPOCH FROM (work_orders.completed_at - work_orders.created_at)) / 3600"))

          (created.keys + completed.keys).uniq.sort.map do |date|
            { date: date, created: created[date].to_i, completed: completed[date].to_i, resolution_hours: hours[date].to_f.round(1) }
          end
        end

        # The day (or week, or month) a time falls in, in the company's time zone, as a date. `column` is one of our
        # own "table.column" names, never anything from a request.
        def local_period_sql(column, unit)
          connection = ActiveRecord::Base.connection
          local = "#{connection.quote_table_name(column)} AT TIME ZONE 'UTC' AT TIME ZONE #{connection.quote(Time.zone.tzinfo.name)}"
          Arel.sql("DATE_TRUNC(#{connection.quote(unit)}, #{local})::date")
        end

        def render_report(data, name, csv: nil, pdf: nil)
          case params[:format]
          when "csv" then send_report(csv, "text/csv", "#{name}_#{Time.zone.today}.csv")
          when "pdf" then send_report(pdf, "application/pdf", "#{name}_#{Time.zone.today}.pdf")
          when nil, "json" then render json: data
          else render_unsupported_format
          end
        end

        def send_report(builder, type, filename)
          return render_unsupported_format unless builder

          send_data builder.call, type: type, filename: filename
        end

        def render_unsupported_format
          render_error("This report is not available in that format", :not_acceptable, code: "UNSUPPORTED_FORMAT")
        end
      end
    end
  end
end
