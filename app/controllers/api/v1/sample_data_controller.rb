module Api
  module V1
    # Example data to look around in, and taking it out again. Administrators only.
    class SampleDataController < Api::V1::BaseController
      before_action :require_admin!

      # GET /api/v1/sample_data
      def show
        render json: status_payload
      end

      # POST /api/v1/sample_data
      def create
        SampleDataService.load!(current_organization, current_user)
        ActivityLogService.log(action: "sample_data.loaded", resource: current_organization,
metadata: SampleDataService.counts(current_organization))
        render json: status_payload, status: :created
      rescue SampleDataService::AlreadyLoaded => e
        render_error(e.message, :unprocessable_entity, code: "SAMPLE_DATA_LOADED")
      end

      # DELETE /api/v1/sample_data
      def destroy
        report = SampleDataService.remove!(current_organization)
        ActivityLogService.log(action: "sample_data.removed", resource: current_organization,
metadata: { removed: report[:removed], kept: report[:kept].size })
        render json: status_payload.merge(report: report)
      end

      private

      def status_payload
        { loaded: SampleDataService.loaded?(current_organization), counts: SampleDataService.counts(current_organization) }
      end
    end
  end
end
