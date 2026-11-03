module Api
  module V1
    # Reports kept under a name. Managers and administrators see them all and use any; the person who saved one, and
    # administrators, change or delete it.
    class SavedReportsController < Api::V1::BaseController
      before_action :set_saved_report, only: %i[update destroy send_now]
      before_action :authorize_saved_report

      # GET /api/v1/saved_reports?report=work_orders
      def index
        scope = current_organization.saved_reports.includes(:user)
        scope = scope.where(report: params[:report]) if params[:report].present?
        render json: { saved_reports: render_all(scope.ordered), eligible_recipients: eligible_recipients }
      end

      # POST /api/v1/saved_reports  { saved_report: { name, report, period, filters, send_on, recipient_ids } }
      def create
        saved = current_organization.saved_reports.new(saved_report_params.merge(user: current_user))
        saved.save!
        render json: { data: render_one(saved) }, status: :created
      end

      def update
        @saved_report.update!(saved_report_params)
        render json: { data: render_one(@saved_report) }
      end

      def destroy
        @saved_report.destroy!
        head :no_content
      end

      # POST /api/v1/saved_reports/:id/send_now  Emails the PDF to the person asking, as a test; the schedule and the
      # people chosen are not touched.
      def send_now
        result = SavedReportRun.new(@saved_report).call
        ReportMailer.scheduled(current_user, @saved_report, result).deliver_now
        render json: { sent_to: current_user.email }
      rescue SavedReportRun::Failed => e
        render_error(e.message, :unprocessable_entity, code: "REPORT_FAILED")
      end

      private

      # Who a report can be emailed to: the company's active managers and administrators.
      def eligible_recipients
        current_organization.users.managers.active.order(:first_name, :last_name).map do |person|
          { id: person.id, full_name: person.full_name, role: person.role }
        end
      end

      def render_all(reports) = SavedReportBlueprint.render_as_hash(reports, viewer: current_user)

      def render_one(saved) = SavedReportBlueprint.render_as_hash(saved, viewer: current_user)

      def set_saved_report
        @saved_report = current_organization.saved_reports.find(params[:id])
      end

      def authorize_saved_report
        authorize(@saved_report || SavedReport)
      end

      def saved_report_params
        permitted = params.expect(saved_report: [:name, :report, :period, :send_on, { recipient_ids: [], filters: {} }])
        # A report cannot be moved to another kind: its filters were chosen on the first.
        action_name == "update" ? permitted.except(:report) : permitted
      end
    end
  end
end
