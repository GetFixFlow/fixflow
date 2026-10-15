module Api
  module V1
    module Reports
      # What finished work cost, from the labor and parts costs on each work order. For managers and
      # administrators (the base controller sees to that). The period and the Filters panel's choices apply.
      class CostsController < Reports::BaseController
        # GET /api/v1/reports/costs/summary
        def summary
          from, to = date_range
          render json: report(from, to).summary(period_unit(from, to))
        end

        # GET /api/v1/reports/costs/by_asset
        def by_asset
          from, to = date_range
          render json: report(from, to).by_asset
        end

        # GET /api/v1/reports/costs/by_location
        def by_location
          from, to = date_range
          render json: report(from, to).by_location
        end

        private

        def report(from, to)
          CostReport.new(apply_report_filters(current_organization.work_orders), from: from, to: to)
        end

        # Days for a month or less, weeks up to half a year, months beyond that, unless asked for.
        def period_unit(from, to)
          return params[:group_by] if params[:group_by].in?(VALID_GROUP_BY)

          days = (to.to_date - from.to_date).to_i
          return "day" if days <= 31

          days <= 183 ? "week" : "month"
        end
      end
    end
  end
end
