module Api
  module V1
    module Reports
      class BaseController < Api::V1::BaseController
        VALID_GROUP_BY = %w[day week month].freeze
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

        # Returns [from, to] Time objects, defaulting to last 30 days
        def date_range
          from = params[:from].present? ? Time.zone.parse(params[:from]) : 30.days.ago.beginning_of_day
          to   = params[:to].present?   ? Time.zone.parse(params[:to])   : Time.current.end_of_day

          raise ArgumentError, "from must be before to" if from >= to
          [from, to]
        rescue ArgumentError => e
          raise ActionController::BadRequest, e.message
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

        def trend_data(scope, from, to, group_by)
          trunc = case group_by
                  when "week"  then "week"
                  when "month" then "month"
                  else "day"
                  end

          created_by_period = scope
            .group(Arel.sql("DATE_TRUNC('#{trunc}', created_at)::date"))
            .count

          completed_by_period = scope
            .where(status: %w[completed verified])
            .where.not(completed_at: nil)
            .group(Arel.sql("DATE_TRUNC('#{trunc}', completed_at)::date"))
            .count

          all_dates = (created_by_period.keys + completed_by_period.keys).uniq.sort
          all_dates.map do |date|
            { date: date, created: created_by_period[date].to_i, completed: completed_by_period[date].to_i }
          end
        end

        def require_export_permission!
          require_manager!
        end
      end
    end
  end
end
