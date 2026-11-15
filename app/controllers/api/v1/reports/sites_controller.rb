module Api
  module V1
    module Reports
      # The sites side by side (see SitesReport). For managers and administrators (the base controller sees to that); the period
      # applies. A person at some sites only is shown those.
      class SitesController < Reports::BaseController
        # GET /api/v1/reports/sites?from=&to=
        def show
          from, to = date_range
          render json: { data: SitesReport.new(current_organization, from: from, to: to).call }
        end
      end
    end
  end
end
