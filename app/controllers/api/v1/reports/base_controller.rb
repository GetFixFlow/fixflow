module Api
  module V1
    module Reports
      class BaseController < Api::V1::BaseController
        VALID_GROUP_BY = %w[day week month].freeze

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
          scope = current_organization.work_orders.where(created_at: from..to)
          scope = scope.where(asset_id:   params[:asset_id])    if params[:asset_id].present?
          scope = scope.where(assignee_id: params[:assignee_id]) if params[:assignee_id].present?
          if params[:location_id].present?
            scope = scope.where(asset_id: asset_ids_for_location(params[:location_id]))
          end
          scope
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
