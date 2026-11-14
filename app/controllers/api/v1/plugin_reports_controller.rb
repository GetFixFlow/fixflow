module Api
  module V1
    # The reports plugins add (Plugins::Report). For managers and administrators, like the reports built in (a plugin can read
    # what people are paid, so it is as careful as they are), and only for plugins the company's administrator switched on.
    class PluginReportsController < Api::V1::BaseController
      before_action :require_manager!
      before_action :find_report, only: :show

      # GET /api/v1/plugin_reports
      def index
        settings = Plugins::Settings.for(current_organization)
        reports = Plugins.installed.select { |plugin| settings.enabled?(plugin.key) }.flat_map do |plugin|
          plugin.reports.map { |report| report_json(plugin, report) }
        end
        render json: { reports: reports }
      end

      # GET /api/v1/plugin_reports/:plugin/:report?from=&to=   (.csv for a spreadsheet)
      def show
        from, to = period
        table = @report.run(Plugins::ReportContext.new(organization: current_organization, user: current_user, from: from, to: to,
                                                      params: report_params))
        case params[:format]
        when "csv" then send_data table.csv, type: "text/csv", filename: "#{@plugin.key}_#{@report.key}_#{Time.zone.today}.csv"
        when nil, "json" then render json: { report: report_json(@plugin, @report), from: from&.iso8601, to: to&.iso8601, table: table }
        else render_error("This report is not available in that format", :not_acceptable, code: "UNSUPPORTED_FORMAT")
        end
      rescue Plugins::Error => e
        render_error(e.message, :unprocessable_entity, code: "PLUGIN_REPORT_FAILED")
      end

      private

      def find_report
        @plugin = Plugins.find(params[:plugin])
        @report = @plugin&.find_report(params[:report])
        return render_error("Report not found", :not_found, code: "RESOURCE_NOT_FOUND") unless @report
        return if Plugins::Settings.for(current_organization).enabled?(@plugin.key)

        render_error("This plugin is switched off. An administrator can switch it on under Settings, Plugins.", :not_found,
                     code: "PLUGIN_OFF")
      end

      # The whole day at each end, in the company's time (as the built-in reports do); the last 30 days when not given.
      def period
        return [nil, nil] unless @report.period

        from = params[:from].present? ? Time.zone.parse(params[:from]) : 30.days.ago.beginning_of_day
        to = params[:to].present? ? end_of_day_if_date(params[:to]) : Time.current.end_of_day
        raise ActionController::BadRequest, "from must be before to" if from.nil? || to.nil? || from >= to

        [from, to]
      rescue ArgumentError
        raise ActionController::BadRequest, "from and to must be dates"
      end

      def end_of_day_if_date(text)
        time = Time.zone.parse(text)
        text.to_s.match?(Api::V1::Reports::BaseController::DATE_ONLY) ? time&.end_of_day : time
      end

      # Anything else on the address, for a plugin that takes more than a period.
      def report_params
        params.to_unsafe_h.except(:controller, :action, :format, :plugin, :report, :from, :to).transform_values(&:to_s)
      end

      def report_json(plugin, report)
        { plugin: plugin.key, plugin_title: plugin.title, key: report.key, title: report.title, description: report.description,
          period: report.period }
      end
    end
  end
end
