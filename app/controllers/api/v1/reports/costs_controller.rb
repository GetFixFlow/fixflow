module Api
  module V1
    module Reports
      # What finished work cost, from the labor, parts and vendor costs on each work order. For managers and
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
          report = report(from, to)
          render_report(report.by_asset, "cost_by_asset", csv: -> { ExportService.cost_by_asset_csv(report.asset_rows) })
        end

        # GET /api/v1/reports/costs/by_location
        def by_location
          from, to = date_range
          report = report(from, to)
          render_report(report.by_location, "cost_by_location",
                        csv: -> { ExportService.cost_by_location_csv(report.location_rows) })
        end

        # GET /api/v1/reports/costs/by_vendor
        def by_vendor
          from, to = date_range
          report = report(from, to)
          render_report(report.by_vendor, "cost_by_vendor", csv: -> { ExportService.cost_by_vendor_csv(report.vendor_rows) })
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
