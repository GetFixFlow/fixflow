module Api
  module V1
    # Bring assets, locations or parts in from a CSV file. Managers and administrators.
    #   GET  /api/v1/imports/:kind/template  the file to fill in
    #   POST /api/v1/imports/:kind/preview   what the file would do, changing nothing
    #   POST /api/v1/imports/:kind           do it (all of it, or none of it if any row has a problem)
    class ImportsController < Api::V1::BaseController
      before_action :require_manager!
      before_action :set_importer

      def template
        send_data @importer.template, type: "text/csv", filename: "#{params[:kind]}_template.csv", disposition: "attachment"
      end

      def preview
        render json: payload(@importer.preview(file_content))
      end

      def create
        result = @importer.import!(file_content)
        return render json: payload(result), status: :unprocessable_content unless result.valid?

        ActivityLogService.log(action: "import.#{params[:kind]}", resource: current_organization, metadata: { created: result.created })
        render json: payload(result), status: :created
      end

      private

      def set_importer
        @importer = CsvImport::Base.for(params[:kind], current_organization)
      rescue KeyError
        render_error("You can import assets, locations or parts.", :not_found, code: "RESOURCE_NOT_FOUND")
      end

      def file_content
        file = params[:file]
        raise CsvImport::Base::Unreadable, "Choose a CSV file to upload." unless file.respond_to?(:read)
        if file.size > CsvImport::Base::MAX_BYTES
          raise CsvImport::Base::Unreadable, "The file is larger than #{CsvImport::Base::MAX_BYTES / 1.megabyte} MB."
        end

        file.read
      end

      def payload(result)
        shown = result.errors.first(CsvImport::Base::MAX_ERRORS_SHOWN)
        {
          kind: result.kind, total_rows: result.total_rows, error_count: result.errors.size,
          errors: shown.map { |e| { row: e.row, column: e.column, message: e.message } },
          errors_truncated: result.errors.size > shown.size,
          columns: result.columns, preview: result.preview, created: result.created
        }
      end

      rescue_from CsvImport::Base::Unreadable do |error|
        render_error(error.message, :unprocessable_entity, code: "IMPORT_UNREADABLE")
      end
    end
  end
end
